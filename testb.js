import { BSON } from "bson";

console.log(BSON);

var bytes = BSON.serialize({"foo": [1, 2, 3]});

console.log(bytes);

var json = BSON.deserialize(bytes);

console.log(json);
