Some GET endpoints can offer filtering. Through this mechanism, it is possible to set search conditions, in order to filter the results that will be returned by the specific endpoint.

The supported filtering operators are:

### Equal

Find elements where a field is equal to a specific value.

For example: ``` GET /reports?name=sample-report``` returns all the reports with the name "sample-report".

### Not equal

Find elements where a field is different to a specific value.

For example: ``` GET /reports?status!=completed``` returns all the reports that aren't completed.

### Greater than

Find elements where a field is greater than a specific value.

For example: ``` GET /reports?views>0``` returns all the reports with more than 0 views.

### Greather than or equal

Find elements where a field is greater than or equal to a specific value.

For example: ``` GET /reports?stars>=1``` returns all the reports with at least 1 star.

### Lesser than

Find elements where a field is lesser than a specific value.

For example: ``` GET /reports?views<5``` returns all the reports with less than 5 views.

### Lesser than or equal

Find elements where a field is lesser than or equal to a specific value.

For example: ``` GET /reports?stars<=1``` returns all the reports with 1 or less stars.

### In

Find elements where a field has a value from a collection.

For example: ``` GET /reports?language=en,es``` returns all the reports that are in english or spanish.

### Not in

Find elements where a field has a value that isn't in a collection.

For example: ``` GET /reports?topic!=engineering,marketing``` returns all the reports that aren't about engineering or marketing.

### Exists

Find elements where a field exists.

For example: ``` GET /reports?contactData``` returns all the reports that have contact data.

### Not exists

Find elements where a field doesn't exist.

For example: ``` GET /reports?!contactData``` returns all the reports that don't have contact data.

### Like

Find elements where a field matches a regular expression.

For example: ``` GET /reports?description=/money/``` returns all the reports that mention money.

### Not like

Find elements where a field doesn't match a regular expression.

For example: ``` GET /reports?created_date!=/2020/``` returns all the reports that weren't created during 2020.