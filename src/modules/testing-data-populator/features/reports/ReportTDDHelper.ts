import { Logger } from '@nestjs/common';
import { CommentsService } from 'src/modules/comments/comments.service';
import { Comment, CreateReportDTO, RepositoryProvider, User } from '@kyso-io/kyso-model';
import { ReportsService } from 'src/modules/reports/reports.service';
import slug from 'src/helpers/slugify';
import { faker } from '@faker-js/faker';

export class ReportsTDDHelper {
  public static async createReport(author: User, report: CreateReportDTO, reportsService: ReportsService) {
    try {
      Logger.log(`Creating ${report.name} report...`);
      return reportsService.createReport(author.id, report);
    } catch (ex) {
      Logger.log(`${report.name} report already exists`);
    }
  }

  public static async generateRandomReport(channelId: string, fixedReportId?: string): Promise<any> {
    const reportTitle = faker.company.catchPhrase();

    const randomReport = new CreateReportDTO(slug(reportTitle), null, RepositoryProvider.KYSO, 'main', '.', channelId, reportTitle, faker.hacker.phrase(), null, null, fixedReportId);

    return randomReport;
  }

  /**
   * Creates a random report
   * @param creator Creator of the report
   * @param channelId Channel in which the report will be placed
   * @param reportsService instance of reportsService
   * @param count Optional, number of reports to create
   */
  private async insertRandomReports(creator: User, channelId: string, reportsService: ReportsService, count?: number): Promise<any> {
    try {
      let numberOfReportsToCreate = 1;

      if (count && count > 0) {
        numberOfReportsToCreate = count;
      }

      for (let i = 0; i < numberOfReportsToCreate; i++) {
        try {
          const randomReport = await ReportsTDDHelper.generateRandomReport(channelId);
          await ReportsTDDHelper.createReport(creator, randomReport, reportsService);
        } catch (ex) {
          Logger.error('Error generating random report', ex);
        }
      }
    } catch (ex) {
      Logger.error('Error generating random report', ex);
    }
  }
}
