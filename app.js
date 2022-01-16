const json = {
  "data": [
      {
          "user_id": "61dc523cec1d0fde7418779c",
          "team_id": "61dc523cec1d0fde741877a4",
          "name": "reys-report",
          "provider": {
              "source": null,
              "owner": "team-contributor",
              "name": "reys-report",
              "defaultBranch": "main",
              "basePath": "."
          },
          "links": {
              "self_api": "/rey/reys-report",
              "self_ui": "/rey/reys-report"
          },
          "numberOfComments": 0,
          "stars": 0,
          "views": 0,
          "created_at": "2022-01-10T15:35:24.498Z",
          "id": "61dc523cec1d0fde741877ad"
      }
  ],
  "relations": {
      "user": {
          "61dc523cec1d0fde7418779c": {
              "_id": "61dc523cec1d0fde7418779c",
              "email": "rey@kyso.io",
              "username": "rey@kyso.io",
              "nickname": "rey",
              "provider": "kyso",
              "bio": "[Team Admin] Rey is a Team Admin",
              "plan": "free",
              "avatar_url": "https://bit.ly/3Fgdosn",
              "email_verified": true,
              "global_permissions": [],
              "hashed_password": "$2a$10$DHmMFG2MfrXfe5xeLAXpW.AY408KcnB2IUAtNkzJ4e/JDi5CKxxGy",
              "accessToken": "",
              "accounts": [],
              "created_at": "2022-01-10T15:35:24.136Z"
          }
      },
      "team": {
          "61dc523cec1d0fde741877a4": {
              "_id": "61dc523cec1d0fde741877a4",
              "name": "protected-team",
              "avatar_url": "https://bit.ly/3e9mDOZ",
              "bio": "A protected team with custom roles",
              "location": "Sacramento",
              "roles": [
                  {
                      "name": "custom-team-random-role",
                      "permissions": [
                          "KYSO_IO_READ_REPORT"
                      ]
                  }
              ],
              "organization_id": "61dc523cec1d0fde741877a2",
              "visibility": "protected",
              "created_at": "2022-01-10T15:35:24.490Z"
          }
      }
  }
}

console.log(
  // Object.fromEntries(
    [
      Object.keys(json.relations),
      Object.keys(json.relations).map((collection) => {
          const keys = Object.keys(json.relations[collection])
          return keys.map((key) => {
            const model = json.relations[collection][key]
            return model
          })
      })
    ]
  // )
)
