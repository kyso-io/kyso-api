This API offers a simple pagination mechanism through page and per_page.

**Per_page** can be used to specify the amount of items to be returned in a GET endpoint.

Most endpoints already have a set limit and a maximum amount of elements that can be returned, but this parameter allows a bit of flexibility.

For example, we can use the following parameter to receive only three reports.

```
GET /reports?per_page=3
```

**Page** allows skipping a certain amount of elements, and helps with implement pagination when strict limits exists.

For example, to implement pages of 10 elements each, we would use the following parameters:

```
GET /reports?per_page=10           // First page

GET /reports?per_page=10&page=2   // Second page

GET /reports?per_page=10&page=3   // Third page
```