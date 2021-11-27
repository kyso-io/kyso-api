Sorting is supported in some GET endpoints (refer to the specific endpoint documentation). Sorting is specified through the **sort** parameter, and it accepts a comma-separated list of fields. It will default to sorting in ascending order, but descending order can be specified using a - prefix.

For example, we can use this to sort by ascending name and descending creation date:

``` GET /reports?sort=name,-created_at ```