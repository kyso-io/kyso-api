import { NormalizedResponseDTO, Tag } from '@kyso-io/kyso-model'

import { Controller, Get, Query, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'

import { ApiNormalizedResponse } from '../../decorators/api-normalized-response'

import { PermissionsGuard } from '../auth/guards/permission.guard'


@ApiTags('search')
@UseGuards(PermissionsGuard)
@ApiBearerAuth()
@Controller('search')
export class FullTextSearchController {
    constructor() {  }

    @Get()
    @ApiOperation({
        summary: `Search`,
        description: `Search`,
    })
    @ApiQuery({name:"terms", required: true, description: "Search tearms to perform the search"})
    @ApiQuery({name:"page", required: true, description: "Result's page to be retrieved"})
    @ApiQuery({name:"type", required: true, description: "Type of object to search for", example: "reports, discussions, comments, members" })
    @ApiQuery({name:"perPage", required: false, description: "Number of results per page. 20 if not set", })
    @ApiQuery({name:"filter.tags", required: false, description: "List of tags to filter", example: "tag1,tag2,tag3"})
    @ApiQuery({name:"filter.orgs", required: false, description: "List or organizations to filter", example: "lightside,darkside"})
    @ApiQuery({name:"filter.teams", required: false, description: "List or teams to filter", example: "protected-team,private-team,public-team"})
    @ApiQuery({name:"filter.people", required: false, description: "List or persons to filter", example: "palpatine@kyso.io,rey@kyso.io"})
    @ApiNormalizedResponse({ status: 200, description: `Search results`, type: Tag, isArray: true })
    public async search(
        @Query('terms') searchTerms: string, 
        @Query('page') page: number, 
        @Query('perPage') perPage: number, 
        @Query('type') type: string, 
        @Query('filter.tags') filterTags: string, 
        @Query('filter.orgs') filterOrgs: string, 
        @Query('filter.teams') filterTeams: string, 
        @Query('filter.people') filterPeople: string, 
    ): Promise<NormalizedResponseDTO<any[]>> {
        const searchResults = [
            {
                reports : {
                    results: [
                        { 
                            title: "Map bisulfite converted sequence reads", 
                            summary: "Bismark is a tool to map bisulfite converted sequence reads and determine cytosine methylation states.DOI: 10.1093/bioinformatics/btr167", 
                            link: "https://dev.kyso.io/lightside/protected-team/map-bisulfite-converted-sequence-reads-bismark",
                            type: "report",
                            people: ["rey@kyso.io", "palpatine@kyso.io" ],
                            team: "protected-team",
                            organization: "lightside",
                            tags: [],
                            score: 1.9832
                        },
                        { 
                            title: "Mandalorian's Cred", 
                            summary: "This is the mandalorian's cred", 
                            link: "https://dev.kyso.io/lightside/mandalorian-team/mandalorians-cred",
                            type: "report",
                            people: ["chewbacca@kyso.io", "kylo@kyso.io" ],
                            team: "mandalorian-team",
                            organization: "lightside",
                            tags: ["jedi", "creed", "bobba fet"],
                            score: 1.2832
                        },
                        { 
                            title: "Jupyter Book Example", 
                            summary: "genome-sampler documentation Thanks for your interest in genome-sampler!This page is main entry point into the genome-sampler documentation. After reading this documentation, you’ll know how to install and use genome-sampler and where to turn if you need help.Getting started with genome-sampler Installation instructions for genome-sampler are available in our genome-sampler installation instructions.To learn how to use genome-sampler you can work through our genome-sampler usage tutorial after installing.Getting help, contributing, and our community code of conduct If you need technical support, please post a question to the QIIME 2 Forum.NoteYou’ll get help more quickly on the QIIME 2 Forum than if you email the developers directly, since many people are monitoring the forum for support requests, while your message might get lost in an individual developers email inbox for days or weeks if they’re busy with other projects.We are very interested in contributions to genome-sampler from the community. Please get in touch via the GitHub issue tracker or the QIIME 2 Forum if you’re interested in contributing.If genome-sampler is missing a feature that would be helpful for your work, please post to the GitHub issue tracker.Before getting in touch, please review the software project’s code of conduct, which is adapted from the Contributor Covenant, version 1.4.Licensing and source code genome-sampler is open-source and free for all use. Software and unit tests are available in our GitHub repository under the BSD 3-clause license.About genome-sampler genome-sampler is a QIIME 2 plugin. QIIME 2 offers useful features for bioinformatics software, including that it ensures reproducibility of analyses and it is interface agnostic, meaning that the same functionality can be accessed through a command line interface, a Python 3 API, and various graphical interfaces that are currently in different stages of development. If you’re interested in learning more about QIIME 2 and how it can help with your bioinformatics software, read the QIIME 2 paper [4] and then the QIIME 2 developer documentation.genome-sampler’s documentation is written using Myst and rendered using Jupyter Book.genome-sampler is primarily developed at the Pathogen and Microbiome Institute at Northern Arizona University.Citing genome-sampler If you use genome-sampler in published work, we ask that you cite our paper [5].The primary workflow implemented in genome-sampler also makes extensive use of vsearch [1], so you should also cite that in your published work.If you use other components of QIIME 2 (as discussed in downstream-workflows) you may end up using other tools that need to be cited. If you load a .qza or .qzv file with QIIME 2 View, you can obtain a list of the papers you should cite under the Details tab in Bibtex format. That file can be loaded into most citation managers, such as Paperpile or EndNote.", 
                            link: "https://dev.kyso.io/lightside/protected-team/jupyter-book-example",
                            type: "report",
                            people: [ ],
                            team: "protected-team",
                            organization: "lightside",
                            tags: ["jupyter", "book", "genome"],
                            score: 1.0832
                        },
                        { 
                            title: "Map bisulfite converted sequence reads", 
                            summary: "Bismark is a tool to map bisulfite converted sequence reads and determine cytosine methylation states.DOI: 10.1093/bioinformatics/btr167", 
                            link: "https://dev.kyso.io/lightside/protected-team/map-bisulfite-converted-sequence-reads-bismark",
                            type: "report",
                            people: ["rey@kyso.io", "palpatine@kyso.io" ],
                            team: "protected-team",
                            organization: "lightside",
                            tags: [],
                            score: 0.9
                        },
                        { 
                            title: "Mandalorian's Cred", 
                            summary: "This is the mandalorian's cred", 
                            link: "https://dev.kyso.io/lightside/mandalorian-team/mandalorians-cred",
                            type: "report",
                            people: ["chewbacca@kyso.io", "kylo@kyso.io" ],
                            team: "mandalorian-team",
                            organization: "lightside",
                            tags: [],
                            score: 0.8
                        },
                        { 
                            title: "Jupyter Book Example", 
                            summary: "genome-sampler documentation Thanks for your interest in genome-sampler!This page is main entry point into the genome-sampler documentation. After reading this documentation, you’ll know how to install and use genome-sampler and where to turn if you need help.Getting started with genome-sampler Installation instructions for genome-sampler are available in our genome-sampler installation instructions.To learn how to use genome-sampler you can work through our genome-sampler usage tutorial after installing.Getting help, contributing, and our community code of conduct If you need technical support, please post a question to the QIIME 2 Forum.NoteYou’ll get help more quickly on the QIIME 2 Forum than if you email the developers directly, since many people are monitoring the forum for support requests, while your message might get lost in an individual developers email inbox for days or weeks if they’re busy with other projects.We are very interested in contributions to genome-sampler from the community. Please get in touch via the GitHub issue tracker or the QIIME 2 Forum if you’re interested in contributing.If genome-sampler is missing a feature that would be helpful for your work, please post to the GitHub issue tracker.Before getting in touch, please review the software project’s code of conduct, which is adapted from the Contributor Covenant, version 1.4.Licensing and source code genome-sampler is open-source and free for all use. Software and unit tests are available in our GitHub repository under the BSD 3-clause license.About genome-sampler genome-sampler is a QIIME 2 plugin. QIIME 2 offers useful features for bioinformatics software, including that it ensures reproducibility of analyses and it is interface agnostic, meaning that the same functionality can be accessed through a command line interface, a Python 3 API, and various graphical interfaces that are currently in different stages of development. If you’re interested in learning more about QIIME 2 and how it can help with your bioinformatics software, read the QIIME 2 paper [4] and then the QIIME 2 developer documentation.genome-sampler’s documentation is written using Myst and rendered using Jupyter Book.genome-sampler is primarily developed at the Pathogen and Microbiome Institute at Northern Arizona University.Citing genome-sampler If you use genome-sampler in published work, we ask that you cite our paper [5].The primary workflow implemented in genome-sampler also makes extensive use of vsearch [1], so you should also cite that in your published work.If you use other components of QIIME 2 (as discussed in downstream-workflows) you may end up using other tools that need to be cited. If you load a .qza or .qzv file with QIIME 2 View, you can obtain a list of the papers you should cite under the Details tab in Bibtex format. That file can be loaded into most citation managers, such as Paperpile or EndNote.", 
                            link: "https://dev.kyso.io/lightside/protected-team/jupyter-book-example",
                            type: "report",
                            people: [ ],
                            team: "protected-team",
                            organization: "lightside",
                            tags: [],
                            score: 0.7
                        },
                        { 
                            title: "Map bisulfite converted sequence reads", 
                            summary: "Bismark is a tool to map bisulfite converted sequence reads and determine cytosine methylation states.DOI: 10.1093/bioinformatics/btr167", 
                            link: "https://dev.kyso.io/lightside/protected-team/map-bisulfite-converted-sequence-reads-bismark",
                            type: "report",
                            people: ["rey@kyso.io", "palpatine@kyso.io" ],
                            team: "protected-team",
                            organization: "lightside",
                            tags: [],
                            score: 0.6
                        },
                        { 
                            title: "Mandalorian's Cred", 
                            summary: "This is the mandalorian's cred", 
                            link: "https://dev.kyso.io/lightside/mandalorian-team/mandalorians-cred",
                            type: "report",
                            people: ["chewbacca@kyso.io", "kylo@kyso.io" ],
                            team: "mandalorian-team",
                            organization: "lightside",
                            tags: [],
                            score: 0.5
                        },
                        { 
                            title: "Jupyter Book Example", 
                            summary: "genome-sampler documentation Thanks for your interest in genome-sampler!This page is main entry point into the genome-sampler documentation. After reading this documentation, you’ll know how to install and use genome-sampler and where to turn if you need help.Getting started with genome-sampler Installation instructions for genome-sampler are available in our genome-sampler installation instructions.To learn how to use genome-sampler you can work through our genome-sampler usage tutorial after installing.Getting help, contributing, and our community code of conduct If you need technical support, please post a question to the QIIME 2 Forum.NoteYou’ll get help more quickly on the QIIME 2 Forum than if you email the developers directly, since many people are monitoring the forum for support requests, while your message might get lost in an individual developers email inbox for days or weeks if they’re busy with other projects.We are very interested in contributions to genome-sampler from the community. Please get in touch via the GitHub issue tracker or the QIIME 2 Forum if you’re interested in contributing.If genome-sampler is missing a feature that would be helpful for your work, please post to the GitHub issue tracker.Before getting in touch, please review the software project’s code of conduct, which is adapted from the Contributor Covenant, version 1.4.Licensing and source code genome-sampler is open-source and free for all use. Software and unit tests are available in our GitHub repository under the BSD 3-clause license.About genome-sampler genome-sampler is a QIIME 2 plugin. QIIME 2 offers useful features for bioinformatics software, including that it ensures reproducibility of analyses and it is interface agnostic, meaning that the same functionality can be accessed through a command line interface, a Python 3 API, and various graphical interfaces that are currently in different stages of development. If you’re interested in learning more about QIIME 2 and how it can help with your bioinformatics software, read the QIIME 2 paper [4] and then the QIIME 2 developer documentation.genome-sampler’s documentation is written using Myst and rendered using Jupyter Book.genome-sampler is primarily developed at the Pathogen and Microbiome Institute at Northern Arizona University.Citing genome-sampler If you use genome-sampler in published work, we ask that you cite our paper [5].The primary workflow implemented in genome-sampler also makes extensive use of vsearch [1], so you should also cite that in your published work.If you use other components of QIIME 2 (as discussed in downstream-workflows) you may end up using other tools that need to be cited. If you load a .qza or .qzv file with QIIME 2 View, you can obtain a list of the papers you should cite under the Details tab in Bibtex format. That file can be loaded into most citation managers, such as Paperpile or EndNote.", 
                            link: "https://dev.kyso.io/lightside/protected-team/jupyter-book-example",
                            type: "report",
                            people: [ ],
                            team: "protected-team",
                            organization: "lightside",
                            tags: [],
                            score: 0.4
                        },
                        { 
                            title: "Jupyter Book Example", 
                            summary: "genome-sampler documentation Thanks for your interest in genome-sampler!This page is main entry point into the genome-sampler documentation. After reading this documentation, you’ll know how to install and use genome-sampler and where to turn if you need help.Getting started with genome-sampler Installation instructions for genome-sampler are available in our genome-sampler installation instructions.To learn how to use genome-sampler you can work through our genome-sampler usage tutorial after installing.Getting help, contributing, and our community code of conduct If you need technical support, please post a question to the QIIME 2 Forum.NoteYou’ll get help more quickly on the QIIME 2 Forum than if you email the developers directly, since many people are monitoring the forum for support requests, while your message might get lost in an individual developers email inbox for days or weeks if they’re busy with other projects.We are very interested in contributions to genome-sampler from the community. Please get in touch via the GitHub issue tracker or the QIIME 2 Forum if you’re interested in contributing.If genome-sampler is missing a feature that would be helpful for your work, please post to the GitHub issue tracker.Before getting in touch, please review the software project’s code of conduct, which is adapted from the Contributor Covenant, version 1.4.Licensing and source code genome-sampler is open-source and free for all use. Software and unit tests are available in our GitHub repository under the BSD 3-clause license.About genome-sampler genome-sampler is a QIIME 2 plugin. QIIME 2 offers useful features for bioinformatics software, including that it ensures reproducibility of analyses and it is interface agnostic, meaning that the same functionality can be accessed through a command line interface, a Python 3 API, and various graphical interfaces that are currently in different stages of development. If you’re interested in learning more about QIIME 2 and how it can help with your bioinformatics software, read the QIIME 2 paper [4] and then the QIIME 2 developer documentation.genome-sampler’s documentation is written using Myst and rendered using Jupyter Book.genome-sampler is primarily developed at the Pathogen and Microbiome Institute at Northern Arizona University.Citing genome-sampler If you use genome-sampler in published work, we ask that you cite our paper [5].The primary workflow implemented in genome-sampler also makes extensive use of vsearch [1], so you should also cite that in your published work.If you use other components of QIIME 2 (as discussed in downstream-workflows) you may end up using other tools that need to be cited. If you load a .qza or .qzv file with QIIME 2 View, you can obtain a list of the papers you should cite under the Details tab in Bibtex format. That file can be loaded into most citation managers, such as Paperpile or EndNote.", 
                            link: "https://dev.kyso.io/lightside/protected-team/jupyter-book-example",
                            type: "report",
                            people: [ ],
                            team: "protected-team",
                            organization: "lightside",
                            tags: [],
                            score: 0.3
                        }
                    ],
                    organizations: [
                        "lightside", 
                        "darkside"
                    ], 
                    teams: [
                        "protected-team",
                        "private-team",
                        "public-team",
                        "mandalorian-team",
                        "bobba-fet-book",
                        "jabba-el-hut-team"
                    ],
                    tags: [
                        "jedi", "creed", "bobba fet", "jupyter", "book", "genome"
                    ],
                    metadata: {
                        page: 1,
                        pages: 5,
                        perPage: 10,
                        total: 50
                    }
                },
                discussions: {
                    results: [],
                    organizations: [],
                    teams: [],
                    tags: [],
                    metadata: {
                        total: 23
                    }
                },
                comments: {
                    results: [],
                    organizations: [],
                    teams: [],
                    tags: [],
                    metadata: {
                        total: 871
                    }
                },
                members: {
                    results: [],
                    organizations: [],
                    teams: [],
                    tags: [],
                    metadata: {
                        total: 4
                    }
                }
            }
        ];

        return new NormalizedResponseDTO(searchResults);
    }

}
