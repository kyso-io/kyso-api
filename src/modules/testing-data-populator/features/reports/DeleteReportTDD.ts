import { Team, User } from '@kyso-io/kyso-model';
import { ReportsTDDHelper } from '../reports/ReportTDDHelper';
import { ReportsService } from 'src/modules/reports/reports.service';

export class DeleteReportTDD {
  public static async createReports(
    reportsService: ReportsService,
    APITests_PublicChannel: Team,
    APITests_ProtectedChannel: Team,
    APITests_PrivateChannel: Team,
    Kylo_TeamContributorUser: User,
    Ahsoka_ExternalUser: User,
    Chewbacca_TeamReaderUser: User,
    Leia_OrgAdmin: User,
    Rey_TeamAdminUser: User,
    Amidala_Reader: User,
  ): Promise<void> {
    const rr1 = await ReportsTDDHelper.generateRandomReport(APITests_PublicChannel.id, '63596fd9b3388dc3de683ead');
    await ReportsTDDHelper.createReport(Chewbacca_TeamReaderUser, rr1, reportsService);

    const rr2 = await ReportsTDDHelper.generateRandomReport(APITests_ProtectedChannel.id, '63597688eddfd38c1d7b44a5');
    await ReportsTDDHelper.createReport(Chewbacca_TeamReaderUser, rr2, reportsService);

    const rr3 = await ReportsTDDHelper.generateRandomReport(APITests_PrivateChannel.id, '635976c24de76e0e9451d8b3');
    await ReportsTDDHelper.createReport(Chewbacca_TeamReaderUser, rr3, reportsService);

    const rr4 = await ReportsTDDHelper.generateRandomReport(APITests_PublicChannel.id, '63597c477d26f8fbbc9d8ba4');
    await ReportsTDDHelper.createReport(Ahsoka_ExternalUser, rr4, reportsService);

    const rr5 = await ReportsTDDHelper.generateRandomReport(APITests_ProtectedChannel.id, '63597caeb00fd5b902813aa9');
    await ReportsTDDHelper.createReport(Ahsoka_ExternalUser, rr5, reportsService);

    const rr6 = await ReportsTDDHelper.generateRandomReport(APITests_PrivateChannel.id, '63597d243ef740bde54aad46');
    await ReportsTDDHelper.createReport(Kylo_TeamContributorUser, rr6, reportsService);

    const rr7 = await ReportsTDDHelper.generateRandomReport(APITests_PublicChannel.id, '63597dfce86ab9f1dd20c5df');
    await ReportsTDDHelper.createReport(Leia_OrgAdmin, rr7, reportsService);

    const rr8 = await ReportsTDDHelper.generateRandomReport(APITests_ProtectedChannel.id, '63597e77de9ddb0aa5c03059');
    await ReportsTDDHelper.createReport(Leia_OrgAdmin, rr8, reportsService);

    const rr9 = await ReportsTDDHelper.generateRandomReport(APITests_PrivateChannel.id, '63597f35e9f8e31a0642288c');
    await ReportsTDDHelper.createReport(Kylo_TeamContributorUser, rr9, reportsService);

    const rr10 = await ReportsTDDHelper.generateRandomReport(APITests_PrivateChannel.id, '63597f8a549ed03279144ead');
    await ReportsTDDHelper.createReport(Rey_TeamAdminUser, rr10, reportsService);

    const rr11 = await ReportsTDDHelper.generateRandomReport(APITests_PublicChannel.id, '6359800d1a2d0631ffc9fe95');
    await ReportsTDDHelper.createReport(Amidala_Reader, rr11, reportsService);

    const rr12 = await ReportsTDDHelper.generateRandomReport(APITests_ProtectedChannel.id, '635980ab77aa10746b01606e');
    await ReportsTDDHelper.createReport(Amidala_Reader, rr12, reportsService);

    const rr13 = await ReportsTDDHelper.generateRandomReport(APITests_PrivateChannel.id, '6359813ce4b9ea2012aea302');
    await ReportsTDDHelper.createReport(Kylo_TeamContributorUser, rr13, reportsService);

    const rr14 = await ReportsTDDHelper.generateRandomReport(APITests_PrivateChannel.id, '635981a574a32b3860aa6d6a');
    await ReportsTDDHelper.createReport(Leia_OrgAdmin, rr14, reportsService);
  }
}
