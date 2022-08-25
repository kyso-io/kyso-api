<!-- Generator: Widdershins v4.0.1 -->

<h1 id="kyso-s-api">Kyso's API v1</h1>

> Scroll down for code samples, example requests and responses. Select a language for code samples from the tabs above or the mobile navigation menu.

Spec for Kyso's API    

Base URLs:

License: <a href="http://www.apache.org/licenses/LICENSE-2.0.html">Apache 2.0</a>

# Authentication

- HTTP Authentication, scheme: bearer 

<h1 id="kyso-s-api-user">user</h1>

## UserController_getAuthenticatedUser

<a id="opIdUserController_getAuthenticatedUser"></a>

> Code samples

`GET /v1/user`

*Get the authenticated user*

Allows fetching content of the authenticated user

<h3 id="usercontroller_getauthenticateduser-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|authorization|header|string|true|none|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "email": "string",
    "username": "string",
    "nickname": "string",
    "provider": "kyso",
    "bio": "string",
    "plan": "string",
    "avatar_url": "string",
    "email_verified": true,
    "global_permissions": [
      "string"
    ],
    "hashed_password": "string",
    "accessToken": "string",
    "_email_verify_token": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="usercontroller_getauthenticateduser-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Authenticated user data|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="usercontroller_getauthenticateduser-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[User](#schemauser)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» email|string|true|none|none|
|»» username|string|true|none|none|
|»» nickname|string|true|none|none|
|»» provider|string|true|none|none|
|»» bio|string|true|none|none|
|»» plan|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» email_verified|boolean|true|none|none|
|»» global_permissions|[string]|true|none|none|
|»» hashed_password|string|true|none|none|
|»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»» _email_verify_token|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

<h1 id="kyso-s-api-users">users</h1>

## UsersController_getUsers

<a id="opIdUsersController_getUsers"></a>

> Code samples

`GET /v1/users`

*Search and fetch users*

By passing the appropiate parameters you can fetch and filter the users of the platform.
            **This endpoint supports filtering**. Refer to the User schema to see available options.

<h3 id="userscontroller_getusers-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|page|query|number(int32)|false|Allows skipping some elements for pagination purposes|
|per_page|query|number(int32)|false|Limits the amount of reports returned by the request|
|fields|query|string(string)|false|Specify which fields of the reports will be returned|
|sort|query|string(string)|false|Decide how the returned reports are sorted|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "email": "string",
    "username": "string",
    "nickname": "string",
    "provider": "kyso",
    "bio": "string",
    "plan": "string",
    "avatar_url": "string",
    "email_verified": true,
    "global_permissions": [
      "string"
    ],
    "hashed_password": "string",
    "accessToken": "string",
    "_email_verify_token": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="userscontroller_getusers-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Users matching criteria|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="userscontroller_getusers-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[User](#schemauser)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» email|string|true|none|none|
|»» username|string|true|none|none|
|»» nickname|string|true|none|none|
|»» provider|string|true|none|none|
|»» bio|string|true|none|none|
|»» plan|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» email_verified|boolean|true|none|none|
|»» global_permissions|[string]|true|none|none|
|»» hashed_password|string|true|none|none|
|»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»» _email_verify_token|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## UsersController_createUser

<a id="opIdUsersController_createUser"></a>

> Code samples

`POST /v1/users`

*Creates an user*

If requester has UserPermissionsEnum.CREATE permission, creates an user

> Body parameter

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "email": "string",
  "username": "string",
  "nickname": "string",
  "provider": "kyso",
  "bio": "string",
  "plan": "string",
  "avatar_url": "string",
  "email_verified": true,
  "global_permissions": [
    "string"
  ],
  "password": "string"
}
```

<h3 id="userscontroller_createuser-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateUserRequest](#schemacreateuserrequest)|true|none|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "email": "string",
    "username": "string",
    "nickname": "string",
    "provider": "kyso",
    "bio": "string",
    "plan": "string",
    "avatar_url": "string",
    "email_verified": true,
    "global_permissions": [
      "string"
    ],
    "hashed_password": "string",
    "accessToken": "string",
    "_email_verify_token": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="userscontroller_createuser-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|User creation gone well|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="userscontroller_createuser-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[User](#schemauser)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» email|string|true|none|none|
|»» username|string|true|none|none|
|»» nickname|string|true|none|none|
|»» provider|string|true|none|none|
|»» bio|string|true|none|none|
|»» plan|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» email_verified|boolean|true|none|none|
|»» global_permissions|[string]|true|none|none|
|»» hashed_password|string|true|none|none|
|»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»» _email_verify_token|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## UsersController_getUser

<a id="opIdUsersController_getUser"></a>

> Code samples

`GET /v1/users/{userName}`

*Get an user*

Allows fetching content of a specific user passing its name

<h3 id="userscontroller_getuser-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|userName|path|string|true|Name of the user to fetch|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "email": "string",
    "username": "string",
    "nickname": "string",
    "provider": "kyso",
    "bio": "string",
    "plan": "string",
    "avatar_url": "string",
    "email_verified": true,
    "global_permissions": [
      "string"
    ],
    "hashed_password": "string",
    "accessToken": "string",
    "_email_verify_token": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="userscontroller_getuser-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|User matching name|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="userscontroller_getuser-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[User](#schemauser)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» email|string|true|none|none|
|»» username|string|true|none|none|
|»» nickname|string|true|none|none|
|»» provider|string|true|none|none|
|»» bio|string|true|none|none|
|»» plan|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» email_verified|boolean|true|none|none|
|»» global_permissions|[string]|true|none|none|
|»» hashed_password|string|true|none|none|
|»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»» _email_verify_token|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## UsersController_updateUserData

<a id="opIdUsersController_updateUserData"></a>

> Code samples

`PATCH /v1/users/{email}`

*Update an user*

Allows updating an user passing its name

> Body parameter

```json
{
  "nickname": "string",
  "bio": "string",
  "accessToken": "string"
}
```

<h3 id="userscontroller_updateuserdata-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|email|path|string|true|Email of the user to update|
|body|body|[UpdateUserRequest](#schemaupdateuserrequest)|true|none|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "email": "string",
    "username": "string",
    "nickname": "string",
    "provider": "kyso",
    "bio": "string",
    "plan": "string",
    "avatar_url": "string",
    "email_verified": true,
    "global_permissions": [
      "string"
    ],
    "hashed_password": "string",
    "accessToken": "string",
    "_email_verify_token": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="userscontroller_updateuserdata-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Authenticated user data|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="userscontroller_updateuserdata-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[User](#schemauser)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» email|string|true|none|none|
|»» username|string|true|none|none|
|»» nickname|string|true|none|none|
|»» provider|string|true|none|none|
|»» bio|string|true|none|none|
|»» plan|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» email_verified|boolean|true|none|none|
|»» global_permissions|[string]|true|none|none|
|»» hashed_password|string|true|none|none|
|»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»» _email_verify_token|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## UsersController_deleteUser

<a id="opIdUsersController_deleteUser"></a>

> Code samples

`DELETE /v1/users/{mail}`

*Deletes an user*

Allows deleting a specific user passing its email

<h3 id="userscontroller_deleteuser-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|mail|path|string|true|Name of the user to delete|

> Example responses

> 400 Response

```json
{}
```

<h3 id="userscontroller_deleteuser-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Deletion done successfully|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## UsersController_addAccount

<a id="opIdUsersController_addAccount"></a>

> Code samples

`PATCH /v1/users/{email}/accounts`

*Add an account to an user*

Allows adding an account to an user passing its username

> Body parameter

```json
{}
```

<h3 id="userscontroller_addaccount-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|email|path|string|true|Email of the user to add an account|
|body|body|[UserAccount](#schemauseraccount)|true|none|

> Example responses

> 400 Response

```json
{}
```

<h3 id="userscontroller_addaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Account added successfully|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## UsersController_removeAccount

<a id="opIdUsersController_removeAccount"></a>

> Code samples

`DELETE /v1/users/{email}/accounts/{provider}/{accountId}`

*Remove an account from an user*

Allows removing an account from an user passing its username

<h3 id="userscontroller_removeaccount-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|email|path|string|true|Email of the user to remove an account|
|provider|path|string|true|Provider of the account to remove|
|accountId|path|string|true|Id of the account to remove|

> Example responses

> 400 Response

```json
{}
```

<h3 id="userscontroller_removeaccount-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Account removed successfully|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

<h1 id="kyso-s-api-auth">auth</h1>

## AuthController_login

<a id="opIdAuthController_login"></a>

> Code samples

`POST /v1/auth/login`

*Logs an user into Kyso*

Allows existing users to log-in into Kyso

> Body parameter

```json
{
  "username": "string",
  "password": "string",
  "provider": "kyso"
}
```

<h3 id="authcontroller_login-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[Login](#schemalogin)|true|none|

> Example responses

> 200 Response

```json
"string"
```

<h3 id="authcontroller_login-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|JWT token related to user|string|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<aside class="success">
This operation does not require authentication
</aside>

## AuthController_signUp

<a id="opIdAuthController_signUp"></a>

> Code samples

`POST /v1/auth/sign-up`

*Signs up an user into Kyso*

Allows new users to sign-up into Kyso

> Body parameter

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "email": "string",
  "username": "string",
  "nickname": "string",
  "provider": "kyso",
  "bio": "string",
  "plan": "string",
  "avatar_url": "string",
  "email_verified": true,
  "global_permissions": [
    "string"
  ],
  "password": "string"
}
```

<h3 id="authcontroller_signup-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateUserRequest](#schemacreateuserrequest)|true|none|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "email": "string",
    "username": "string",
    "nickname": "string",
    "provider": "kyso",
    "bio": "string",
    "plan": "string",
    "avatar_url": "string",
    "email_verified": true,
    "global_permissions": [
      "string"
    ],
    "hashed_password": "string",
    "accessToken": "string",
    "_email_verify_token": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="authcontroller_signup-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Registered user|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="authcontroller_signup-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[User](#schemauser)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» email|string|true|none|none|
|»» username|string|true|none|none|
|»» nickname|string|true|none|none|
|»» provider|string|true|none|none|
|»» bio|string|true|none|none|
|»» plan|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» email_verified|boolean|true|none|none|
|»» global_permissions|[string]|true|none|none|
|»» hashed_password|string|true|none|none|
|»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»» _email_verify_token|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="kyso-s-api-repos-bitbucket">repos/bitbucket</h1>

## BitbucketReposController_getRepos

<a id="opIdBitbucketReposController_getRepos"></a>

> Code samples

`GET /v1/repos/bitbucket`

*By passing in the appropriate options, you can search for available repositories in the linked git provider account*

> Example responses

> 200 Response

```json
{
  "owner": "string",
  "name": "string",
  "full_name": "string",
  "default_branch": "string",
  "description": "string",
  "is_private": true,
  "language": "string",
  "pushed_at": "2019-08-24T14:15:22Z"
}
```

<h3 id="bitbucketreposcontroller_getrepos-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Search results matching criteria|[Repository](#schemarepository)|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<aside class="success">
This operation does not require authentication
</aside>

## BitbucketReposController_getRepo

<a id="opIdBitbucketReposController_getRepo"></a>

> Code samples

`GET /v1/repos/bitbucket/{repoOwner}/{repoName}`

*Fetch data for a repository, after specifying the owner and the name of the repository*

<h3 id="bitbucketreposcontroller_getrepo-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|repoOwner|path|string|true|none|
|repoName|path|string|true|none|

> Example responses

> 200 Response

```json
{
  "owner": "string",
  "name": "string",
  "full_name": "string",
  "default_branch": "string",
  "description": "string",
  "is_private": true,
  "language": "string",
  "pushed_at": "2019-08-24T14:15:22Z"
}
```

<h3 id="bitbucketreposcontroller_getrepo-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|The data of the specified repository|[Repository](#schemarepository)|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<aside class="success">
This operation does not require authentication
</aside>

## BitbucketReposController_getRepoTree

<a id="opIdBitbucketReposController_getRepoTree"></a>

> Code samples

`GET /v1/repos/bitbucket/{repoOwner}/{repoName}/{branch}/tree`

*Get the tree of a specific repository*

<h3 id="bitbucketreposcontroller_getrepotree-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|repoOwner|path|string|true|none|
|repoName|path|string|true|none|
|branch|path|string|true|none|

> Example responses

> 200 Response

```json
{
  "owner": "string",
  "name": "string",
  "full_name": "string",
  "default_branch": "string",
  "description": "string",
  "is_private": true,
  "language": "string",
  "pushed_at": "2019-08-24T14:15:22Z"
}
```

<h3 id="bitbucketreposcontroller_getrepotree-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|The data of the specified repository|[Repository](#schemarepository)|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<aside class="success">
This operation does not require authentication
</aside>

## BitbucketReposController_getAuthenticatedUser

<a id="opIdBitbucketReposController_getAuthenticatedUser"></a>

> Code samples

`GET /v1/repos/bitbucket/user`

*Get data about the git provider account that was linked with the requesting user account.*

> Example responses

> 400 Response

```json
{}
```

<h3 id="bitbucketreposcontroller_getauthenticateduser-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|The data of the specified repository|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<aside class="success">
This operation does not require authentication
</aside>

<h1 id="kyso-s-api-repos-github">repos/github</h1>

## GithubReposController_getRepos

<a id="opIdGithubReposController_getRepos"></a>

> Code samples

`GET /v1/repos/github`

*Get and search repositories*

By passing in the appropriate options, you can search for available repositories in the linked git provider account

> Example responses

> 200 Response

```json
{
  "data": {
    "owner": "string",
    "name": "string",
    "full_name": "string",
    "default_branch": "string",
    "description": "string",
    "is_private": true,
    "language": "string",
    "pushed_at": "2019-08-24T14:15:22Z"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="githubreposcontroller_getrepos-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Search results matching criteria|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="githubreposcontroller_getrepos-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Repository](#schemarepository)|false|none|none|
|»» owner|string|true|none|none|
|»» name|string|true|none|none|
|»» full_name|string|true|none|none|
|»» default_branch|string|true|none|none|
|»» description|string|true|none|none|
|»» is_private|boolean|true|none|none|
|»» language|string|true|none|none|
|»» pushed_at|string(date-time)|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## GithubReposController_getRepo

<a id="opIdGithubReposController_getRepo"></a>

> Code samples

`GET /v1/repos/github/{repoOwner}/{repoName}`

*Get a single repository*

Fetch data for a repository, after specifying the owner and the name of the repository

<h3 id="githubreposcontroller_getrepo-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|repoOwner|path|string|true|Name of the owner of the repository to fetch|
|repoName|path|string|true|Name of the repository to fetch|

> Example responses

> 200 Response

```json
{
  "data": {
    "owner": "string",
    "name": "string",
    "full_name": "string",
    "default_branch": "string",
    "description": "string",
    "is_private": true,
    "language": "string",
    "pushed_at": "2019-08-24T14:15:22Z"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="githubreposcontroller_getrepo-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|The data of the specified repository|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="githubreposcontroller_getrepo-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Repository](#schemarepository)|false|none|none|
|»» owner|string|true|none|none|
|»» name|string|true|none|none|
|»» full_name|string|true|none|none|
|»» default_branch|string|true|none|none|
|»» description|string|true|none|none|
|»» is_private|boolean|true|none|none|
|»» language|string|true|none|none|
|»» pushed_at|string(date-time)|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## GithubReposController_getRepoTree

<a id="opIdGithubReposController_getRepoTree"></a>

> Code samples

`GET /v1/repos/github/{repoOwner}/{repoName}/{branch}/tree`

*Explore a repository tree*

Get the tree of a specific repository

<h3 id="githubreposcontroller_getrepotree-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|repoOwner|path|string|true|Name of the owner of the repository to fetch|
|repoName|path|string|true|Name of the repository to fetch|
|branch|path|string|true|Branch to fetch content from. Accepts slashes.|

> Example responses

> 200 Response

```json
{
  "data": {
    "owner": "string",
    "name": "string",
    "full_name": "string",
    "default_branch": "string",
    "description": "string",
    "is_private": true,
    "language": "string",
    "pushed_at": "2019-08-24T14:15:22Z"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="githubreposcontroller_getrepotree-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|The data of the specified repository|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="githubreposcontroller_getrepotree-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Repository](#schemarepository)|false|none|none|
|»» owner|string|true|none|none|
|»» name|string|true|none|none|
|»» full_name|string|true|none|none|
|»» default_branch|string|true|none|none|
|»» description|string|true|none|none|
|»» is_private|boolean|true|none|none|
|»» language|string|true|none|none|
|»» pushed_at|string(date-time)|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## GithubReposController_getAuthenticatedUser

<a id="opIdGithubReposController_getAuthenticatedUser"></a>

> Code samples

`GET /v1/repos/github/user`

*Get git logged user info*

Get data about the git provider account that was linked with the requesting user account.

> Example responses

> 200 Response

```json
{
  "data": {
    "id": 0,
    "login": "string",
    "orgs": {}
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="githubreposcontroller_getauthenticateduser-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|The data of the specified repository|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="githubreposcontroller_getauthenticateduser-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[GithubAccount](#schemagithubaccount)|false|none|none|
|»» id|number|true|none|none|
|»» login|string|true|none|none|
|»» orgs|object|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## GithubReposController_getUserByAccessToken

<a id="opIdGithubReposController_getUserByAccessToken"></a>

> Code samples

`GET /v1/repos/github/user/access_token/{accessToken}`

*Get git user info by access token*

Get data about the git provider account that belongs to the provided access token

<h3 id="githubreposcontroller_getuserbyaccesstoken-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|accessToken|path|string|true|Github's access token related to the user you want to fetch data|

> Example responses

> 200 Response

```json
{
  "data": {
    "id": 0,
    "login": "string",
    "orgs": {}
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="githubreposcontroller_getuserbyaccesstoken-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|The data of the specified repository|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="githubreposcontroller_getuserbyaccesstoken-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[GithubAccount](#schemagithubaccount)|false|none|none|
|»» id|number|true|none|none|
|»» login|string|true|none|none|
|»» orgs|object|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## GithubReposController_getUserEmailByAccessToken

<a id="opIdGithubReposController_getUserEmailByAccessToken"></a>

> Code samples

`GET /v1/repos/github/user/email/access_token/{accessToken}`

*Get email user info by access token*

Get email data about the git provider account that belongs to the provided access token

<h3 id="githubreposcontroller_getuseremailbyaccesstoken-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|accessToken|path|string|true|Github's access token related to the user you want to fetch email data|

> Example responses

> 200 Response

```json
{
  "data": {
    "id": 0,
    "login": "string",
    "orgs": {}
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="githubreposcontroller_getuseremailbyaccesstoken-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|The data of the specified repository|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="githubreposcontroller_getuseremailbyaccesstoken-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[GithubAccount](#schemagithubaccount)|false|none|none|
|»» id|number|true|none|none|
|»» login|string|true|none|none|
|»» orgs|object|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

<h1 id="kyso-s-api-organizations">organizations</h1>

## OrganizationsController_getOrganization

<a id="opIdOrganizationsController_getOrganization"></a>

> Code samples

`GET /v1/organizations/{organizationName}`

*Get an organization*

Allows fetching content of a specific organization passing its name

<h3 id="organizationscontroller_getorganization-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|organizationName|path|string|true|Name of the organization to fetch|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "roles": [
      {
        "id": "string",
        "name": "string",
        "permissions": [
          "string"
        ]
      }
    ],
    "billingEmail": "string",
    "subscriptionId": "string",
    "allowGoogleLogin": true
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="organizationscontroller_getorganization-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Organization matching name|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="organizationscontroller_getorganization-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Organization](#schemaorganization)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»» id|string|true|none|Role identificator|
|»»» name|string|true|none|Role name|
|»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»» billingEmail|string|true|none|Mail where the billing communications will go|
|»» subscriptionId|string|true|none|Stripe identificator for payments|
|»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## OrganizationsController_updateOrganization

<a id="opIdOrganizationsController_updateOrganization"></a>

> Code samples

`PATCH /v1/organizations/{organizationName}`

*Update an organization*

By passing the appropiate parameters you can update an organization

> Body parameter

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "roles": [
    {
      "id": "string",
      "name": "string",
      "permissions": [
        "string"
      ]
    }
  ],
  "billingEmail": "string",
  "subscriptionId": "string",
  "allowGoogleLogin": true
}
```

<h3 id="organizationscontroller_updateorganization-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|organizationName|path|string|true|none|
|body|body|[Organization](#schemaorganization)|true|none|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "roles": [
      {
        "id": "string",
        "name": "string",
        "permissions": [
          "string"
        ]
      }
    ],
    "billingEmail": "string",
    "subscriptionId": "string",
    "allowGoogleLogin": true
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="organizationscontroller_updateorganization-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Updated organization|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="organizationscontroller_updateorganization-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Organization](#schemaorganization)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»» id|string|true|none|Role identificator|
|»»» name|string|true|none|Role name|
|»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»» billingEmail|string|true|none|Mail where the billing communications will go|
|»» subscriptionId|string|true|none|Stripe identificator for payments|
|»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## OrganizationsController_getOrganizationMembers

<a id="opIdOrganizationsController_getOrganizationMembers"></a>

> Code samples

`GET /v1/organizations/{organizationName}/members`

*Get all the members of an organization*

Allows fetching content of a specific organization passing its name

<h3 id="organizationscontroller_getorganizationmembers-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|organizationName|path|string|true|Name of the organization to fetch|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "roles": [
      {
        "id": "string",
        "name": "string",
        "permissions": [
          "string"
        ]
      }
    ],
    "billingEmail": "string",
    "subscriptionId": "string",
    "allowGoogleLogin": true
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="organizationscontroller_getorganizationmembers-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Organization matching name|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="organizationscontroller_getorganizationmembers-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Organization](#schemaorganization)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»» id|string|true|none|Role identificator|
|»»» name|string|true|none|Role name|
|»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»» billingEmail|string|true|none|Mail where the billing communications will go|
|»» subscriptionId|string|true|none|Stripe identificator for payments|
|»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## OrganizationsController_updateOrganizationMembers

<a id="opIdOrganizationsController_updateOrganizationMembers"></a>

> Code samples

`POST /v1/organizations/{organizationName}/members`

*Update the members of an organization*

By passing the appropiate parameters you can update the members of an organization

> Body parameter

```json
{}
```

<h3 id="organizationscontroller_updateorganizationmembers-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|organizationName|path|string|true|none|
|body|body|[UpdateOrganizationMembers](#schemaupdateorganizationmembers)|true|none|

> Example responses

> 200 Response

```json
{
  "data": null,
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="organizationscontroller_updateorganizationmembers-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Updated organization|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="organizationscontroller_updateorganizationmembers-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|any|false|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## OrganizationsController_createOrganization

<a id="opIdOrganizationsController_createOrganization"></a>

> Code samples

`POST /v1/organizations`

*Create a new organization*

By passing the appropiate parameters you can create a new organization

> Body parameter

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "roles": [
    {
      "id": "string",
      "name": "string",
      "permissions": [
        "string"
      ]
    }
  ],
  "billingEmail": "string",
  "subscriptionId": "string",
  "allowGoogleLogin": true
}
```

<h3 id="organizationscontroller_createorganization-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[Organization](#schemaorganization)|true|none|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "roles": [
      {
        "id": "string",
        "name": "string",
        "permissions": [
          "string"
        ]
      }
    ],
    "billingEmail": "string",
    "subscriptionId": "string",
    "allowGoogleLogin": true
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="organizationscontroller_createorganization-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Created organization|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="organizationscontroller_createorganization-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Organization](#schemaorganization)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»» id|string|true|none|Role identificator|
|»»» name|string|true|none|Role name|
|»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»» billingEmail|string|true|none|Mail where the billing communications will go|
|»» subscriptionId|string|true|none|Stripe identificator for payments|
|»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## OrganizationsController_removeOrganizationMember

<a id="opIdOrganizationsController_removeOrganizationMember"></a>

> Code samples

`DELETE /v1/organizations/{organizationName}/members/{memberId}/{role}`

*remove a user's role in an organization*

By passing the appropiate parameters you can remove a user's role in an organization

<h3 id="organizationscontroller_removeorganizationmember-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|organizationName|path|string|true|none|
|memberId|path|string|true|none|
|role|path|string|true|none|

> Example responses

> 200 Response

```json
{
  "data": null,
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="organizationscontroller_removeorganizationmember-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Updated organization|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="organizationscontroller_removeorganizationmember-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|any|false|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

<h1 id="kyso-s-api-reports">reports</h1>

## ReportsController_getReports

<a id="opIdReportsController_getReports"></a>

> Code samples

`GET /v1/reports`

*Search and fetch reports*

By passing the appropiate parameters you can fetch and filter the reports available to the authenticated user.<br />
         **This endpoint supports filtering**. Refer to the Report schema to see available options.

<h3 id="reportscontroller_getreports-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|page|query|number(int32)|false|Allows skipping some elements for pagination purposes|
|per_page|query|number(int32)|false|Limits the amount of reports returned by the request|
|fields|query|string(string)|false|Specify which fields of the reports will be returned|
|sort|query|string(string)|false|Decide how the returned reports are sorted|
|owner|query|string(string)|false|Return only reports belonging to the specified owner. Can be a user or a team|
|pinned|query|boolean(boolean)|false|Return only reports that are pinned|
|tags|query|string(string)|false|Return only reports that has at least one the tags provided|

> Example responses

> 200 Response

```json
{
  "data": [
    {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "name": "string",
      "views": 0,
      "stars": 0,
      "number_of_comments": 0,
      "analytics": {},
      "provider": {},
      "source": {},
      "pin": true,
      "tags": [
        "string"
      ],
      "description": "string",
      "request_private": true,
      "user_id": "string",
      "comment_ids": [
        "string"
      ],
      "team_id": "string"
    }
  ],
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_getreports-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Reports matching criteria|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_getreports-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[[Report](#schemareport)]|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» views|number|true|none|none|
|»» stars|number|true|none|none|
|»» number_of_comments|number|true|none|none|
|»» analytics|object|true|none|none|
|»» provider|object|true|none|none|
|»» source|object|true|none|none|
|»» pin|boolean|true|none|none|
|»» tags|[string]|true|none|none|
|»» description|string|true|none|none|
|»» request_private|boolean|true|none|none|
|»» user_id|string(faker: datatype.uuid)|true|none|none|
|»» comment_ids|[string]|true|none|none|
|»» team_id|string(faker: datatype.uuid)|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_createReport

<a id="opIdReportsController_createReport"></a>

> Code samples

`POST /v1/reports`

*Create a new report*

By passing the appropiate parameters you can create a new report referencing a git repository

> Body parameter

```json
{
  "teams": "string",
  "reports": {
    "provider": "github",
    "owner": "string",
    "name": "string",
    "default_branch": "string",
    "path": "string",
    "team_id": "string"
  }
}
```

<h3 id="reportscontroller_createreport-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[CreateReportRequest](#schemacreatereportrequest)|true|Pass an array to create multiple objects|

> Example responses

> 201 Response

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "name": "string",
  "views": 0,
  "stars": 0,
  "number_of_comments": 0,
  "analytics": {},
  "provider": {},
  "source": {},
  "pin": true,
  "tags": [
    "string"
  ],
  "description": "string",
  "request_private": true,
  "user_id": "string",
  "comment_ids": [
    "string"
  ],
  "team_id": "string"
}
```

<h3 id="reportscontroller_createreport-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|201|[Created](https://tools.ietf.org/html/rfc7231#section-6.3.2)|Created report object if passed a single Report, or an array of report creation status if passed an array of reports to create (see schemas)|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_createreport-responseschema">Response Schema</h3>

#### Enumerated Values

|Property|Value|
|---|---|
|status|ERROR|
|status|OK|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_getReport

<a id="opIdReportsController_getReport"></a>

> Code samples

`GET /v1/reports/{reportOwner}/{reportName}`

*Get a report*

Allows fetching content of a specific report passing its full name

<h3 id="reportscontroller_getreport-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|reportName|path|string|true|Name of the report to fetch|
|reportOwner|path|string|true|Name of the owner of the report to fetch|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "views": 0,
    "stars": 0,
    "number_of_comments": 0,
    "analytics": {},
    "provider": {},
    "source": {},
    "pin": true,
    "tags": [
      "string"
    ],
    "description": "string",
    "request_private": true,
    "user_id": "string",
    "comment_ids": [
      "string"
    ],
    "team_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_getreport-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Report matching id|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_getreport-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Report](#schemareport)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» views|number|true|none|none|
|»» stars|number|true|none|none|
|»» number_of_comments|number|true|none|none|
|»» analytics|object|true|none|none|
|»» provider|object|true|none|none|
|»» source|object|true|none|none|
|»» pin|boolean|true|none|none|
|»» tags|[string]|true|none|none|
|»» description|string|true|none|none|
|»» request_private|boolean|true|none|none|
|»» user_id|string(faker: datatype.uuid)|true|none|none|
|»» comment_ids|[string]|true|none|none|
|»» team_id|string(faker: datatype.uuid)|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_updateReport

<a id="opIdReportsController_updateReport"></a>

> Code samples

`PATCH /v1/reports/{reportOwner}/{reportName}`

*Update the specific report*

Allows updating content from the specified report

> Body parameter

```json
{
  "location": "string",
  "link": "string",
  "bio": "string"
}
```

<h3 id="reportscontroller_updatereport-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|reportName|path|string|true|Name of the report to fetch|
|reportOwner|path|string|true|Name of the owner of the report to fetch|
|body|body|[UpdateReportRequest](#schemaupdatereportrequest)|true|none|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "views": 0,
    "stars": 0,
    "number_of_comments": 0,
    "analytics": {},
    "provider": {},
    "source": {},
    "pin": true,
    "tags": [
      "string"
    ],
    "description": "string",
    "request_private": true,
    "user_id": "string",
    "comment_ids": [
      "string"
    ],
    "team_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_updatereport-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Specified report data|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_updatereport-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Report](#schemareport)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» views|number|true|none|none|
|»» stars|number|true|none|none|
|»» number_of_comments|number|true|none|none|
|»» analytics|object|true|none|none|
|»» provider|object|true|none|none|
|»» source|object|true|none|none|
|»» pin|boolean|true|none|none|
|»» tags|[string]|true|none|none|
|»» description|string|true|none|none|
|»» request_private|boolean|true|none|none|
|»» user_id|string(faker: datatype.uuid)|true|none|none|
|»» comment_ids|[string]|true|none|none|
|»» team_id|string(faker: datatype.uuid)|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_deleteReport

<a id="opIdReportsController_deleteReport"></a>

> Code samples

`DELETE /v1/reports/{reportOwner}/{reportName}`

*Delete a report*

Allows deleting a specific report

<h3 id="reportscontroller_deletereport-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|reportName|path|string|true|Name of the report to fetch|
|reportOwner|path|string|true|Name of the owner of the report to fetch|

> Example responses

> 400 Response

```json
{}
```

<h3 id="reportscontroller_deletereport-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|204|[No Content](https://tools.ietf.org/html/rfc7231#section-6.3.5)|Report deleted|None|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_getPinnedReportsForAnUser

<a id="opIdReportsController_getPinnedReportsForAnUser"></a>

> Code samples

`GET /v1/reports/{reportOwner}/pinned`

*Get pinned reports for an user*

Allows fetching pinned reports of a specific user passing its full name

<h3 id="reportscontroller_getpinnedreportsforanuser-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|reportOwner|path|string|true|Name of the owner of the report to fetch|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "views": 0,
    "stars": 0,
    "number_of_comments": 0,
    "analytics": {},
    "provider": {},
    "source": {},
    "pin": true,
    "tags": [
      "string"
    ],
    "description": "string",
    "request_private": true,
    "user_id": "string",
    "comment_ids": [
      "string"
    ],
    "team_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_getpinnedreportsforanuser-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|All the pinned reports of an user|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_getpinnedreportsforanuser-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Report](#schemareport)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» views|number|true|none|none|
|»» stars|number|true|none|none|
|»» number_of_comments|number|true|none|none|
|»» analytics|object|true|none|none|
|»» provider|object|true|none|none|
|»» source|object|true|none|none|
|»» pin|boolean|true|none|none|
|»» tags|[string]|true|none|none|
|»» description|string|true|none|none|
|»» request_private|boolean|true|none|none|
|»» user_id|string(faker: datatype.uuid)|true|none|none|
|»» comment_ids|[string]|true|none|none|
|»» team_id|string(faker: datatype.uuid)|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_pinReport

<a id="opIdReportsController_pinReport"></a>

> Code samples

`POST /v1/reports/{reportOwner}/{reportName}/pin`

*Toggles the pin of the specified report*

Allows pinning of the specified report, unpins any other pinned report for owner

<h3 id="reportscontroller_pinreport-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|reportName|path|string|true|Name of the report to fetch|
|reportOwner|path|string|true|Name of the owner of the report to fetch|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "views": 0,
    "stars": 0,
    "number_of_comments": 0,
    "analytics": {},
    "provider": {},
    "source": {},
    "pin": true,
    "tags": [
      "string"
    ],
    "description": "string",
    "request_private": true,
    "user_id": "string",
    "comment_ids": [
      "string"
    ],
    "team_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_pinreport-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Specified report data|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_pinreport-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Report](#schemareport)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» views|number|true|none|none|
|»» stars|number|true|none|none|
|»» number_of_comments|number|true|none|none|
|»» analytics|object|true|none|none|
|»» provider|object|true|none|none|
|»» source|object|true|none|none|
|»» pin|boolean|true|none|none|
|»» tags|[string]|true|none|none|
|»» description|string|true|none|none|
|»» request_private|boolean|true|none|none|
|»» user_id|string(faker: datatype.uuid)|true|none|none|
|»» comment_ids|[string]|true|none|none|
|»» team_id|string(faker: datatype.uuid)|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_getComments

<a id="opIdReportsController_getComments"></a>

> Code samples

`GET /v1/reports/{reportOwner}/{reportName}/comments`

*Get comments of a report*

By passing in the appropriate options you can see all the comments of a report

<h3 id="reportscontroller_getcomments-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|reportName|path|string|true|Name of the report to fetch|
|reportOwner|path|string|true|Name of the owner of the report to fetch|

> Example responses

> 200 Response

```json
{
  "data": [],
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_getcomments-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Comments of the specified report|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_getcomments-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|array|false|none|none|
|»» *anonymous*|any|false|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_getBranches

<a id="opIdReportsController_getBranches"></a>

> Code samples

`GET /v1/reports/{reportOwner}/{reportName}/branches`

*Get branches of a report*

By passing in the appropriate options you can see all the branches of a report

<h3 id="reportscontroller_getbranches-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|reportName|path|string|true|Name of the report to fetch|
|reportOwner|path|string|true|Name of the owner of the report to fetch|

> Example responses

> 200 Response

```json
{
  "data": [],
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_getbranches-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Branches of the specified report|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_getbranches-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|array|false|none|none|
|»» *anonymous*|any|false|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_getCommits

<a id="opIdReportsController_getCommits"></a>

> Code samples

`GET /v1/reports/{reportOwner}/{reportName}/{branch}/commits`

*Get commits of a report imported from a git provider*

By passing in the appropriate options you can see the commits of a branch for the repository the specified report is linked to

<h3 id="reportscontroller_getcommits-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|branch|path|string|true|Branch to start listing commits from. Accepts slashes|
|reportName|path|string|true|Name of the report to fetch|
|reportOwner|path|string|true|Name of the owner of the report to fetch|

> Example responses

> 200 Response

```json
{
  "data": [],
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_getcommits-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Commits of the specified report branch|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_getcommits-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|array|false|none|none|
|»» *anonymous*|any|false|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_getReportFileHash

<a id="opIdReportsController_getReportFileHash"></a>

> Code samples

`GET /v1/reports/{reportOwner}/{reportName}/{branch}/tree/{filePath}`

*Explore a report tree*

Get hash of a file for a given report. If the file is a folder, will get information about the files in it too (non-recursively). Path is currently ignored for local reports.

<h3 id="reportscontroller_getreportfilehash-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|filePath|path|string|true|Path of the file to be consulted|
|branch|path|string|true|Branch of the repository to fetch data from. Accepts slashes.|
|reportName|path|string|true|Name of the report to fetch|
|reportOwner|path|string|true|Name of the owner of the report to fetch|

> Example responses

> 200 Response

```json
{
  "data": null,
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_getreportfilehash-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Content of the requested file|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_getreportfilehash-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|any|false|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## ReportsController_getReportFileContent

<a id="opIdReportsController_getReportFileContent"></a>

> Code samples

`GET /v1/reports/{reportOwner}/{reportName}/file/{hash}`

*Get content of a file*

By passing the hash of a file, get its raw content directly from the source.

<h3 id="reportscontroller_getreportfilecontent-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|hash|path|string|true|Hash of the file to access|
|reportName|path|string|true|Name of the report to fetch|
|reportOwner|path|string|true|Name of the owner of the report to fetch|

> Example responses

> 200 Response

```json
{
  "data": null,
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="reportscontroller_getreportfilecontent-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Content of the requested file|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="reportscontroller_getreportfilecontent-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|any|false|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

<h1 id="kyso-s-api-teams">teams</h1>

## TeamsController_getVisibilityTeams

<a id="opIdTeamsController_getVisibilityTeams"></a>

> Code samples

`GET /v1/teams`

*Get all team's in which user has visibility*

Allows fetching content of all the teams that the user has visibility

<h3 id="teamscontroller_getvisibilityteams-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|x-kyso-organization|header|string|true|Organization|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "avatar_url": "string",
    "bio": "string",
    "link": "string",
    "location": "string",
    "roles": [
      {
        "id": "string",
        "name": "string",
        "permissions": [
          "string"
        ]
      }
    ],
    "visibility": "public",
    "organization_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="teamscontroller_getvisibilityteams-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Team matching name|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="teamscontroller_getvisibilityteams-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Team](#schemateam)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» bio|string|true|none|none|
|»» link|string|true|none|none|
|»» location|string|true|none|none|
|»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»» id|string|true|none|Role identificator|
|»»» name|string|true|none|Role name|
|»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»» visibility|string|true|none|none|
|»» organization_id|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|visibility|public|
|visibility|protected|
|visibility|private|
|provider|kyso|
|provider|google|
|provider|github|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## TeamsController_createTeam

<a id="opIdTeamsController_createTeam"></a>

> Code samples

`POST /v1/teams`

*Create a new team*

Allows creating a new team

> Body parameter

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "name": "string",
  "avatar_url": "string",
  "bio": "string",
  "link": "string",
  "location": "string",
  "roles": [
    {
      "id": "string",
      "name": "string",
      "permissions": [
        "string"
      ]
    }
  ],
  "visibility": "public",
  "organization_id": "string"
}
```

<h3 id="teamscontroller_createteam-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|body|body|[Team](#schemateam)|true|none|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "avatar_url": "string",
    "bio": "string",
    "link": "string",
    "location": "string",
    "roles": [
      {
        "id": "string",
        "name": "string",
        "permissions": [
          "string"
        ]
      }
    ],
    "visibility": "public",
    "organization_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="teamscontroller_createteam-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Created team data|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="teamscontroller_createteam-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Team](#schemateam)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» bio|string|true|none|none|
|»» link|string|true|none|none|
|»» location|string|true|none|none|
|»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»» id|string|true|none|Role identificator|
|»»» name|string|true|none|Role name|
|»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»» visibility|string|true|none|none|
|»» organization_id|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|visibility|public|
|visibility|protected|
|visibility|private|
|provider|kyso|
|provider|google|
|provider|github|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## TeamsController_getTeam

<a id="opIdTeamsController_getTeam"></a>

> Code samples

`GET /v1/teams/{teamName}`

*Get a team*

Allows fetching content of a specific team passing its name

<h3 id="teamscontroller_getteam-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|teamName|path|string|true|Name of the team to fetch|
|x-kyso-team|header|string|true|Name of the team|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "avatar_url": "string",
    "bio": "string",
    "link": "string",
    "location": "string",
    "roles": [
      {
        "id": "string",
        "name": "string",
        "permissions": [
          "string"
        ]
      }
    ],
    "visibility": "public",
    "organization_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="teamscontroller_getteam-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Team matching name|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="teamscontroller_getteam-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Team](#schemateam)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» bio|string|true|none|none|
|»» link|string|true|none|none|
|»» location|string|true|none|none|
|»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»» id|string|true|none|Role identificator|
|»»» name|string|true|none|Role name|
|»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»» visibility|string|true|none|none|
|»» organization_id|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|visibility|public|
|visibility|protected|
|visibility|private|
|provider|kyso|
|provider|google|
|provider|github|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## TeamsController_updateTeam

<a id="opIdTeamsController_updateTeam"></a>

> Code samples

`PATCH /v1/teams/{teamName}`

*Update the specified team*

Allows updating content from the specified team

> Body parameter

```json
{
  "location": "string",
  "link": "string",
  "bio": "string"
}
```

<h3 id="teamscontroller_updateteam-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|teamName|path|string|true|Name of the team to fetch|
|x-kyso-team|header|string|true|Name of the team|
|body|body|[UpdateTeamRequest](#schemaupdateteamrequest)|true|none|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "avatar_url": "string",
    "bio": "string",
    "link": "string",
    "location": "string",
    "roles": [
      {
        "id": "string",
        "name": "string",
        "permissions": [
          "string"
        ]
      }
    ],
    "visibility": "public",
    "organization_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="teamscontroller_updateteam-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Specified team data|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="teamscontroller_updateteam-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Team](#schemateam)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» bio|string|true|none|none|
|»» link|string|true|none|none|
|»» location|string|true|none|none|
|»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»» id|string|true|none|Role identificator|
|»»» name|string|true|none|Role name|
|»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»» visibility|string|true|none|none|
|»» organization_id|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|visibility|public|
|visibility|protected|
|visibility|private|
|provider|kyso|
|provider|google|
|provider|github|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## TeamsController_getTeamMembers

<a id="opIdTeamsController_getTeamMembers"></a>

> Code samples

`GET /v1/teams/{teamName}/members`

*Get the member's team*

Allows fetching content of a specific team passing its name

<h3 id="teamscontroller_getteammembers-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|teamName|path|string|true|Name of the team to fetch|
|x-kyso-team|header|string|true|Name of the team|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "avatar_url": "string",
    "bio": "string",
    "link": "string",
    "location": "string",
    "roles": [
      {
        "id": "string",
        "name": "string",
        "permissions": [
          "string"
        ]
      }
    ],
    "visibility": "public",
    "organization_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="teamscontroller_getteammembers-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Team matching name|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="teamscontroller_getteammembers-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Team](#schemateam)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» avatar_url|string|true|none|none|
|»» bio|string|true|none|none|
|»» link|string|true|none|none|
|»» location|string|true|none|none|
|»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»» id|string|true|none|Role identificator|
|»»» name|string|true|none|Role name|
|»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»» visibility|string|true|none|none|
|»» organization_id|string|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» views|number|true|none|none|
|»»»» stars|number|true|none|none|
|»»»» number_of_comments|number|true|none|none|
|»»»» analytics|object|true|none|none|
|»»»» provider|object|true|none|none|
|»»»» source|object|true|none|none|
|»»»» pin|boolean|true|none|none|
|»»»» tags|[string]|true|none|none|
|»»»» description|string|true|none|none|
|»»»» request_private|boolean|true|none|none|
|»»»» user_id|string(faker: datatype.uuid)|true|none|none|
|»»»» comment_ids|[string]|true|none|none|
|»»»» team_id|string(faker: datatype.uuid)|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|visibility|public|
|visibility|protected|
|visibility|private|
|provider|kyso|
|provider|google|
|provider|github|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

## TeamsController_getReportsOfTeam

<a id="opIdTeamsController_getReportsOfTeam"></a>

> Code samples

`GET /v1/teams/{teamName}/reports`

*Get the reports of the specified team*

Allows fetching content of a specific team passing its name

<h3 id="teamscontroller_getreportsofteam-parameters">Parameters</h3>

|Name|In|Type|Required|Description|
|---|---|---|---|---|
|teamName|path|string|true|Name of the team to fetch|
|x-kyso-team|header|string|true|Name of the team|

> Example responses

> 200 Response

```json
{
  "data": {
    "type": "string",
    "id": "string",
    "created_at": "2019-08-24T14:15:22Z",
    "updated_at": "2019-08-24T14:15:22Z",
    "links": {},
    "name": "string",
    "views": 0,
    "stars": 0,
    "number_of_comments": 0,
    "analytics": {},
    "provider": {},
    "source": {},
    "pin": true,
    "tags": [
      "string"
    ],
    "description": "string",
    "request_private": true,
    "user_id": "string",
    "comment_ids": [
      "string"
    ],
    "team_id": "string"
  },
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}
```

<h3 id="teamscontroller_getreportsofteam-responses">Responses</h3>

|Status|Meaning|Description|Schema|
|---|---|---|---|
|200|[OK](https://tools.ietf.org/html/rfc7231#section-6.3.1)|Team matching name|Inline|
|400|[Bad Request](https://tools.ietf.org/html/rfc7231#section-6.5.1)|Input is not correct|[Error](#schemaerror)|
|401|[Unauthorized](https://tools.ietf.org/html/rfc7235#section-3.1)|You need to be authenticated to execute this action|[ApiError](#schemaapierror)|
|403|[Forbidden](https://tools.ietf.org/html/rfc7231#section-6.5.3)|You are not allowed to perform this action|[ApiError](#schemaapierror)|
|404|[Not Found](https://tools.ietf.org/html/rfc7231#section-6.5.4)|The resource you are trying to acces can't be found|[ApiError](#schemaapierror)|
|412|[Precondition Failed](https://tools.ietf.org/html/rfc7232#section-4.2)|Precondition failed|[ApiError](#schemaapierror)|
|500|[Internal Server Error](https://tools.ietf.org/html/rfc7231#section-6.6.1)|Internal Error|[Error](#schemaerror)|

<h3 id="teamscontroller_getreportsofteam-responseschema">Response Schema</h3>

Status Code **200**

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» data|[Report](#schemareport)|false|none|none|
|»» type|string|true|none|none|
|»» id|string(faker: datatype.uuid)|true|none|none|
|»» created_at|string(date-time)|true|none|none|
|»» updated_at|string(date-time)|true|none|none|
|»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»» self_api|string|true|none|none|
|»»» self_ui|string|true|none|none|
|»» name|string|true|none|none|
|»» views|number|true|none|none|
|»» stars|number|true|none|none|
|»» number_of_comments|number|true|none|none|
|»» analytics|object|true|none|none|
|»» provider|object|true|none|none|
|»» source|object|true|none|none|
|»» pin|boolean|true|none|none|
|»» tags|[string]|true|none|none|
|»» description|string|true|none|none|
|»» request_private|boolean|true|none|none|
|»» user_id|string(faker: datatype.uuid)|true|none|none|
|»» comment_ids|[string]|true|none|none|
|»» team_id|string(faker: datatype.uuid)|true|none|none|
|» relations|any|false|none|none|

*anyOf*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[User](#schemauser)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» email|string|true|none|none|
|»»»» username|string|true|none|none|
|»»»» nickname|string|true|none|none|
|»»»» provider|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» plan|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» email_verified|boolean|true|none|none|
|»»»» global_permissions|[string]|true|none|none|
|»»»» hashed_password|string|true|none|none|
|»»»» accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|»»»» _email_verify_token|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Report](#schemareport)|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Team](#schemateam)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» name|string|true|none|none|
|»»»» avatar_url|string|true|none|none|
|»»»» bio|string|true|none|none|
|»»»» link|string|true|none|none|
|»»»» location|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»»» id|string|true|none|Role identificator|
|»»»»» name|string|true|none|Role name|
|»»»»» permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|
|»»»» visibility|string|true|none|none|
|»»»» organization_id|string|true|none|none|

*or*

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|»» *anonymous*|object|false|none|none|
|»»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|
|»»»» type|string|true|none|none|
|»»»» id|string(faker: datatype.uuid)|true|none|none|
|»»»» created_at|string(date-time)|true|none|none|
|»»»» updated_at|string(date-time)|true|none|none|
|»»»» links|[Hateoas](#schemahateoas)|true|none|none|
|»»»»» self_api|string|true|none|none|
|»»»»» self_ui|string|true|none|none|
|»»»» roles|[[KysoRole](#schemakysorole)]|true|none|none|
|»»»» billingEmail|string|true|none|Mail where the billing communications will go|
|»»»» subscriptionId|string|true|none|Stripe identificator for payments|
|»»»» allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|
|visibility|public|
|visibility|protected|
|visibility|private|

<aside class="warning">
To perform this operation, you must be authenticated by means of one of the following methods:
bearer
</aside>

# Schemas

<h2 id="tocS_Error">Error</h2>
<!-- backwards compatibility -->
<a id="schemaerror"></a>
<a id="schema_Error"></a>
<a id="tocSerror"></a>
<a id="tocserror"></a>

```json
{}

```

### Properties

*None*

<h2 id="tocS_ApiError">ApiError</h2>
<!-- backwards compatibility -->
<a id="schemaapierror"></a>
<a id="schema_ApiError"></a>
<a id="tocSapierror"></a>
<a id="tocsapierror"></a>

```json
{
  "statusCode": 0,
  "message": "string",
  "error": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|statusCode|number|true|none|none|
|message|string|true|none|none|
|error|string|true|none|none|

<h2 id="tocS_Hateoas">Hateoas</h2>
<!-- backwards compatibility -->
<a id="schemahateoas"></a>
<a id="schema_Hateoas"></a>
<a id="tocShateoas"></a>
<a id="tocshateoas"></a>

```json
{
  "self_api": "string",
  "self_ui": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|self_api|string|true|none|none|
|self_ui|string|true|none|none|

<h2 id="tocS_User">User</h2>
<!-- backwards compatibility -->
<a id="schemauser"></a>
<a id="schema_User"></a>
<a id="tocSuser"></a>
<a id="tocsuser"></a>

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "email": "string",
  "username": "string",
  "nickname": "string",
  "provider": "kyso",
  "bio": "string",
  "plan": "string",
  "avatar_url": "string",
  "email_verified": true,
  "global_permissions": [
    "string"
  ],
  "hashed_password": "string",
  "accessToken": "string",
  "_email_verify_token": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|type|string|true|none|none|
|id|string(faker: datatype.uuid)|true|none|none|
|created_at|string(date-time)|true|none|none|
|updated_at|string(date-time)|true|none|none|
|links|[Hateoas](#schemahateoas)|true|none|none|
|email|string|true|none|none|
|username|string|true|none|none|
|nickname|string|true|none|none|
|provider|string|true|none|none|
|bio|string|true|none|none|
|plan|string|true|none|none|
|avatar_url|string|true|none|none|
|email_verified|boolean|true|none|none|
|global_permissions|[string]|true|none|none|
|hashed_password|string|true|none|none|
|accessToken|string|true|none|OAUTH2 token from OAUTH login providers|
|_email_verify_token|string|true|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|

<h2 id="tocS_CreateUserRequest">CreateUserRequest</h2>
<!-- backwards compatibility -->
<a id="schemacreateuserrequest"></a>
<a id="schema_CreateUserRequest"></a>
<a id="tocScreateuserrequest"></a>
<a id="tocscreateuserrequest"></a>

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "email": "string",
  "username": "string",
  "nickname": "string",
  "provider": "kyso",
  "bio": "string",
  "plan": "string",
  "avatar_url": "string",
  "email_verified": true,
  "global_permissions": [
    "string"
  ],
  "password": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|type|string|true|none|none|
|id|string(faker: datatype.uuid)|true|none|none|
|created_at|string(date-time)|true|none|none|
|updated_at|string(date-time)|true|none|none|
|links|[Hateoas](#schemahateoas)|true|none|none|
|email|string|true|none|none|
|username|string|true|none|none|
|nickname|string|true|none|none|
|provider|string|true|none|none|
|bio|string|true|none|none|
|plan|string|true|none|none|
|avatar_url|string|true|none|none|
|email_verified|boolean|true|none|none|
|global_permissions|[string]|true|none|none|
|password|string|true|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|

<h2 id="tocS_UpdateUserRequest">UpdateUserRequest</h2>
<!-- backwards compatibility -->
<a id="schemaupdateuserrequest"></a>
<a id="schema_UpdateUserRequest"></a>
<a id="tocSupdateuserrequest"></a>
<a id="tocsupdateuserrequest"></a>

```json
{
  "nickname": "string",
  "bio": "string",
  "accessToken": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|nickname|string|true|none|none|
|bio|string|true|none|none|
|accessToken|string|true|none|none|

<h2 id="tocS_UserAccount">UserAccount</h2>
<!-- backwards compatibility -->
<a id="schemauseraccount"></a>
<a id="schema_UserAccount"></a>
<a id="tocSuseraccount"></a>
<a id="tocsuseraccount"></a>

```json
{}

```

### Properties

*None*

<h2 id="tocS_Login">Login</h2>
<!-- backwards compatibility -->
<a id="schemalogin"></a>
<a id="schema_Login"></a>
<a id="tocSlogin"></a>
<a id="tocslogin"></a>

```json
{
  "username": "string",
  "password": "string",
  "provider": "kyso"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|username|string|false|none|Username to login. Only required in kyso provider. This field is ignored in the rest<br>                      of providers|
|password|string|true|none|none|
|provider|string|true|none|Authentication provider in which the user wants to rely. See schema for details|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|kyso|
|provider|google|
|provider|github|

<h2 id="tocS_Repository">Repository</h2>
<!-- backwards compatibility -->
<a id="schemarepository"></a>
<a id="schema_Repository"></a>
<a id="tocSrepository"></a>
<a id="tocsrepository"></a>

```json
{
  "owner": "string",
  "name": "string",
  "full_name": "string",
  "default_branch": "string",
  "description": "string",
  "is_private": true,
  "language": "string",
  "pushed_at": "2019-08-24T14:15:22Z"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|owner|string|true|none|none|
|name|string|true|none|none|
|full_name|string|true|none|none|
|default_branch|string|true|none|none|
|description|string|true|none|none|
|is_private|boolean|true|none|none|
|language|string|true|none|none|
|pushed_at|string(date-time)|true|none|none|

<h2 id="tocS_GithubAccount">GithubAccount</h2>
<!-- backwards compatibility -->
<a id="schemagithubaccount"></a>
<a id="schema_GithubAccount"></a>
<a id="tocSgithubaccount"></a>
<a id="tocsgithubaccount"></a>

```json
{
  "id": 0,
  "login": "string",
  "orgs": {}
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|id|number|true|none|none|
|login|string|true|none|none|
|orgs|object|true|none|none|

<h2 id="tocS_KysoRole">KysoRole</h2>
<!-- backwards compatibility -->
<a id="schemakysorole"></a>
<a id="schema_KysoRole"></a>
<a id="tocSkysorole"></a>
<a id="tocskysorole"></a>

```json
{
  "id": "string",
  "name": "string",
  "permissions": [
    "string"
  ]
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|id|string|true|none|Role identificator|
|name|string|true|none|Role name|
|permissions|[string]|true|none|List of permissions related to this role. See permission reference for more details|

<h2 id="tocS_Organization">Organization</h2>
<!-- backwards compatibility -->
<a id="schemaorganization"></a>
<a id="schema_Organization"></a>
<a id="tocSorganization"></a>
<a id="tocsorganization"></a>

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "roles": [
    {
      "id": "string",
      "name": "string",
      "permissions": [
        "string"
      ]
    }
  ],
  "billingEmail": "string",
  "subscriptionId": "string",
  "allowGoogleLogin": true
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|type|string|true|none|none|
|id|string(faker: datatype.uuid)|true|none|none|
|created_at|string(date-time)|true|none|none|
|updated_at|string(date-time)|true|none|none|
|links|[Hateoas](#schemahateoas)|true|none|none|
|roles|[[KysoRole](#schemakysorole)]|true|none|none|
|billingEmail|string|true|none|Mail where the billing communications will go|
|subscriptionId|string|true|none|Stripe identificator for payments|
|allowGoogleLogin|boolean|true|none|Flag to allow or deny login into the organization using google accounts. True allows google login, false deny it|

<h2 id="tocS_UpdateOrganizationMembers">UpdateOrganizationMembers</h2>
<!-- backwards compatibility -->
<a id="schemaupdateorganizationmembers"></a>
<a id="schema_UpdateOrganizationMembers"></a>
<a id="tocSupdateorganizationmembers"></a>
<a id="tocsupdateorganizationmembers"></a>

```json
{}

```

### Properties

*None*

<h2 id="tocS_BatchReportCreation">BatchReportCreation</h2>
<!-- backwards compatibility -->
<a id="schemabatchreportcreation"></a>
<a id="schema_BatchReportCreation"></a>
<a id="tocSbatchreportcreation"></a>
<a id="tocsbatchreportcreation"></a>

```json
{
  "status": "ERROR",
  "reason": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|status|string|true|none|none|
|reason|string|false|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|status|ERROR|
|status|OK|

<h2 id="tocS_Report">Report</h2>
<!-- backwards compatibility -->
<a id="schemareport"></a>
<a id="schema_Report"></a>
<a id="tocSreport"></a>
<a id="tocsreport"></a>

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "name": "string",
  "views": 0,
  "stars": 0,
  "number_of_comments": 0,
  "analytics": {},
  "provider": {},
  "source": {},
  "pin": true,
  "tags": [
    "string"
  ],
  "description": "string",
  "request_private": true,
  "user_id": "string",
  "comment_ids": [
    "string"
  ],
  "team_id": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|type|string|true|none|none|
|id|string(faker: datatype.uuid)|true|none|none|
|created_at|string(date-time)|true|none|none|
|updated_at|string(date-time)|true|none|none|
|links|[Hateoas](#schemahateoas)|true|none|none|
|name|string|true|none|none|
|views|number|true|none|none|
|stars|number|true|none|none|
|number_of_comments|number|true|none|none|
|analytics|object|true|none|none|
|provider|object|true|none|none|
|source|object|true|none|none|
|pin|boolean|true|none|none|
|tags|[string]|true|none|none|
|description|string|true|none|none|
|request_private|boolean|true|none|none|
|user_id|string(faker: datatype.uuid)|true|none|none|
|comment_ids|[string]|true|none|none|
|team_id|string(faker: datatype.uuid)|true|none|none|

<h2 id="tocS_NormalizedResponse">NormalizedResponse</h2>
<!-- backwards compatibility -->
<a id="schemanormalizedresponse"></a>
<a id="schema_NormalizedResponse"></a>
<a id="tocSnormalizedresponse"></a>
<a id="tocsnormalizedresponse"></a>

```json
{
  "data": "a report, or list of reports",
  "relations": {
    "property1": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    },
    "property2": {
      "type": "string",
      "id": "string",
      "created_at": "2019-08-24T14:15:22Z",
      "updated_at": "2019-08-24T14:15:22Z",
      "links": {},
      "email": "string",
      "username": "string",
      "nickname": "string",
      "provider": "kyso",
      "bio": "string",
      "plan": "string",
      "avatar_url": "string",
      "email_verified": true,
      "global_permissions": [
        "string"
      ],
      "hashed_password": "string",
      "accessToken": "string",
      "_email_verify_token": "string"
    }
  }
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|data|any|true|none|The specific data that has been requested, it is an array or object|

oneOf

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[User](#schemauser)|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[Report](#schemareport)|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[Comment](#schemacomment)|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[Team](#schemateam)|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[Organization](#schemaorganization)|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[[User](#schemauser)]|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[[Report](#schemareport)]|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[[Comment](#schemacomment)]|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[[Team](#schemateam)]|false|none|none|

xor

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|[[Organization](#schemaorganization)]|false|none|none|

continued

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|relations|any|true|none|object with all the fetched relations|

anyOf

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|object|false|none|none|
|»» **additionalProperties**|[User](#schemauser)|false|none|none|

or

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|object|false|none|none|
|»» **additionalProperties**|[Report](#schemareport)|false|none|none|

or

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|object|false|none|none|
|»» **additionalProperties**|[Comment](#schemacomment)|false|none|none|

or

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|object|false|none|none|
|»» **additionalProperties**|[Team](#schemateam)|false|none|none|

or

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|» *anonymous*|object|false|none|none|
|»» **additionalProperties**|[Organization](#schemaorganization)|false|none|none|

<h2 id="tocS_CreateReport">CreateReport</h2>
<!-- backwards compatibility -->
<a id="schemacreatereport"></a>
<a id="schema_CreateReport"></a>
<a id="tocScreatereport"></a>
<a id="tocscreatereport"></a>

```json
{
  "provider": "github",
  "owner": "string",
  "name": "string",
  "default_branch": "string",
  "path": "string",
  "team_id": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|provider|string|true|none|Git provider to retrieve the code|
|owner|string|true|none|none|
|name|string|true|none|none|
|default_branch|string|true|none|none|
|path|string|false|none|none|
|team_id|string|true|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|provider|github|
|provider|gitlab|
|provider|bitbucket|

<h2 id="tocS_CreateReportRequest">CreateReportRequest</h2>
<!-- backwards compatibility -->
<a id="schemacreatereportrequest"></a>
<a id="schema_CreateReportRequest"></a>
<a id="tocScreatereportrequest"></a>
<a id="tocscreatereportrequest"></a>

```json
{
  "teams": "string",
  "reports": {
    "provider": "github",
    "owner": "string",
    "name": "string",
    "default_branch": "string",
    "path": "string",
    "team_id": "string"
  }
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|teams|string|false|none|none|
|reports|[CreateReport](#schemacreatereport)|true|none|none|

<h2 id="tocS_UpdateReportRequest">UpdateReportRequest</h2>
<!-- backwards compatibility -->
<a id="schemaupdatereportrequest"></a>
<a id="schema_UpdateReportRequest"></a>
<a id="tocSupdatereportrequest"></a>
<a id="tocsupdatereportrequest"></a>

```json
{
  "location": "string",
  "link": "string",
  "bio": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|location|string|false|none|none|
|link|string|false|none|none|
|bio|string|false|none|none|

<h2 id="tocS_Team">Team</h2>
<!-- backwards compatibility -->
<a id="schemateam"></a>
<a id="schema_Team"></a>
<a id="tocSteam"></a>
<a id="tocsteam"></a>

```json
{
  "type": "string",
  "id": "string",
  "created_at": "2019-08-24T14:15:22Z",
  "updated_at": "2019-08-24T14:15:22Z",
  "links": {},
  "name": "string",
  "avatar_url": "string",
  "bio": "string",
  "link": "string",
  "location": "string",
  "roles": [
    {
      "id": "string",
      "name": "string",
      "permissions": [
        "string"
      ]
    }
  ],
  "visibility": "public",
  "organization_id": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|type|string|true|none|none|
|id|string(faker: datatype.uuid)|true|none|none|
|created_at|string(date-time)|true|none|none|
|updated_at|string(date-time)|true|none|none|
|links|[Hateoas](#schemahateoas)|true|none|none|
|name|string|true|none|none|
|avatar_url|string|true|none|none|
|bio|string|true|none|none|
|link|string|true|none|none|
|location|string|true|none|none|
|roles|[[KysoRole](#schemakysorole)]|true|none|none|
|visibility|string|true|none|none|
|organization_id|string|true|none|none|

#### Enumerated Values

|Property|Value|
|---|---|
|visibility|public|
|visibility|protected|
|visibility|private|

<h2 id="tocS_UpdateTeamRequest">UpdateTeamRequest</h2>
<!-- backwards compatibility -->
<a id="schemaupdateteamrequest"></a>
<a id="schema_UpdateTeamRequest"></a>
<a id="tocSupdateteamrequest"></a>
<a id="tocsupdateteamrequest"></a>

```json
{
  "location": "string",
  "link": "string",
  "bio": "string"
}

```

### Properties

|Name|Type|Required|Restrictions|Description|
|---|---|---|---|---|
|location|string|true|none|none|
|link|string|true|none|none|
|bio|string|true|none|none|

