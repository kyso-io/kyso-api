# Kyso API

## .env

| Property                        | Description                                                                            | Mandatory | Example |
|---------------------------------|----------------------------------------------------------------------------------------|-----------|---------|
| DATABASE_URI                    | Database URI to connect to                                                             |     X     | mongodb://{{user}}:{{password}}@localhost:27017/kyso?retryWrites=true&w=majority        |
| POPULATE_TEST_DATA              | True if you want to populate with testing data, false if not. **Default value false**  |           | true        |
| POPULATE_TEST_DATA_MAIL_PREFIX  | Populate test data mail prefix. **Default value: lo**                                  |           | dev       |
| PORT                            | Exposed API port. **Default value: 4000**                                              |           | 4000        |
| APP_MOUNT_DIR                   | Specific route to mount the API. **Default value: empty**                              |           | api        |
