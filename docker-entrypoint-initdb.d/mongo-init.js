db = new Mongo().getDB('kyso');

db.createUser({
  user: 'kysodb',
  pwd: 'kysodb',
  roles: [{ role: 'readWrite', db: 'kyso' }],
});
