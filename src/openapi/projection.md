Some GET endpoints offer projection through the parameter **fields**. This parameter accepts a comma-separated list of fields, which indicate the data you want to receive. It's possible to prefix a - to indicate which fields you don't want to receive, but it's not possible to combine inclusion and exclusion mechanics.

For example, we can use it in the following ways:

```
// Return only the name, id and number of views
GET /reports?fields=id,name,views   

// Remove the analytics object from the result
GET /reports?fields=-analytics      
```