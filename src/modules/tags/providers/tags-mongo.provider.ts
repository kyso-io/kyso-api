import { EntityEnum, Report, Tag, TagAssign, Team, TeamVisibilityEnum } from '@kyso-io/kyso-model';
import { Injectable, Logger } from '@nestjs/common';
import { db } from '../../../main';
import { MongoProvider } from '../../../providers/mongo.provider';

@Injectable()
export class TagsMongoProvider extends MongoProvider<Tag> {
  version = 2;

  constructor() {
    super('Tag', db, [
      {
        keys: {
          name: 'text',
        },
      },
    ]);
  }

  populateMinimalData() {
    Logger.log(`${this.baseCollection} has no minimal data to populate`);
  }

  async migrate_from_1_to_2(): Promise<void> {
    const tags: Tag[] = await db.collection('Tag').find({}).toArray();
    for (const tag of tags) {
      Logger.log(`Migrating tag ${tag.id} - ${tag.name}`, TagsMongoProvider.name);
      // Delete tag
      const resultDeleteTag: any = await db.collection('Tag').deleteOne({ id: tag.id });
      if (resultDeleteTag.deletedCount !== 1) {
        Logger.warn(`Tag '${tag.id} - ${tag.name}' not deleted`, TagsMongoProvider.name);
      }
      const tagAssigns: TagAssign[] = await db.collection('TagAssign').find({ tag_id: tag.id }).toArray();
      for (const tagAssign of tagAssigns) {
        if (tagAssign.type !== EntityEnum.REPORT) {
          Logger.warn(`Tag '${tag.id} - ${tag.name}' with TagAssign ${tagAssign.id} is not a report`, TagsMongoProvider.name);
          continue;
        }
        const report: Report = await db.collection('Report').findOne({ _id: this.toObjectId(tagAssign.entity_id) });
        if (!report) {
          Logger.warn(`Tag '${tag.id} - ${tag.name}' for report ${tagAssign.entity_id} not found`, TagsMongoProvider.name);
          continue;
        }
        const team: Team = await db.collection('Team').findOne({ _id: this.toObjectId(report.team_id) });
        if (!team) {
          Logger.warn(`Tag '${tag.id} - ${tag.name}' for report '${report.id} - ${report.sluglified_name}' with Team ${report.team_id} not found`, TagsMongoProvider.name);
          continue;
        }
        // Comprobar si la tag ya existe para la org y para el equipo (si es privado)
        let newTag: Tag = await db.collection('Tag').findOne({
          organization_id: team.organization_id,
          team_id: team.visibility === TeamVisibilityEnum.PRIVATE ? team.id : null,
          name: tag.name.toLowerCase(),
        });
        if (!newTag) {
          newTag = new Tag(team.organization_id, team.visibility === TeamVisibilityEnum.PRIVATE ? team.id : null, tag.name.toLowerCase());
          newTag = await this.create(newTag);
        }
        const newTagAssign: TagAssign = new TagAssign(newTag.id, tagAssign.entity_id, tagAssign.type);
        newTagAssign.created_at = new Date();
        newTagAssign.updated_at = new Date();
        await db.collection('TagAssign').insertOne(newTagAssign);
      }
      // Delete assigns
      const resultDeleteTagAssign: any = await db.collection('TagAssign').deleteMany({ tag_id: tag.id });
      if (resultDeleteTagAssign.deletedCount === 0) {
        Logger.warn(`TagAssigns for tag '${tag.id} - ${tag.name}' not deleted`, TagsMongoProvider.name);
      }
    }
  }
}
