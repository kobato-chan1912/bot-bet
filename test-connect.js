const db = require("./database.js")

async function test()
{
    let games = await db('games').get();
    console.log(games)
}

test()