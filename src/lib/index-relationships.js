/**
* Constants used to identify the index key-record relationships. These effect how the indexSpecs are handled.
*
* Note that that you could interogate the value as a binary number made of 'key value' and "record value". A "one" is encoded as binary zero and "many" as binary 1. E.g.: "one to one" => '00` = 0 (base 10); one-to-many =# '01' = 2 (base 10).
*/
const ONE_TO_ONE = 0 // 00
const ONE_TO_MANY = 2 // 01
// const INDEX_MANY_TO_ONE = 1  // 10 TODO: maybe in future; many to one could be useful for back references and certain groupings, but the processing is a little different.
// const INDEX_MANY_TO_MANY = 3 // 11

export {
  ONE_TO_ONE,
  ONE_TO_MANY
}
