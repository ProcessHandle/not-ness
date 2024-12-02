// 5:33
const express = require('express');
const fs = require('fs');
const luaparse = require('luaparse');

const app = express();

const Table = './Pokemon.lua';

app.use(express.json());

// Recursive function to parse Lua table fields into a nested object
function parseLuaTable(fields) {
    return fields.reduce((acc, field) => {
        if (field.value.type === 'tableconstructor') {
            acc[field.key.name] = parseLuaTable(field.value.fields);
        } else {
            acc[field.key.name] = field.value.value;
        }
        return acc;
    }, {});
}

// Function to get Pokémon data
function getPokemonData(luaTable, name) {
    try {
        const pokemons = luaTable.body[0].init[0].fields;
        const pokemon = pokemons.find(entry => entry.key.name === name);

        if (pokemon) {
            return parseLuaTable(pokemon.value.fields); // Parse the entire tree
        }
        return null;
    } catch (error) {
        console.error('Error parsing Lua table structure:', error);
        return null;
    }
}

// Function to convert JavaScript object to Lua table string
function JsToLuaString(jsobj) {
    function escapeLuaString(value) {
        return value.replace(/"/g, '\\"'); // Escape double quotes
    }

    let luaStr = '_G.Pokemon = {\n';
    for (let name in jsobj) {
        luaStr += `    ["${escapeLuaString(name)}"] = {\n`;
        for (let key in jsobj[name]) {
            const value = jsobj[name][key];
            if (typeof value === 'number') {
                luaStr += `        ${key} = ${value},\n`;
            } else if (typeof value === 'string') {
                luaStr += `        ${key} = "${escapeLuaString(value)}",\n`;
            } else if (typeof value === 'object') {
                luaStr += `        ${key} = ${JsToLuaString(value)},\n`; // Handle nested objects
            }
        }
        luaStr += '    },\n';
    }
    luaStr += '}\n';
    return luaStr;
}

// Endpoint to get Pokémon data
app.get('/pokemon/:name', (req, res) => {
    const PokeName = req.params.name;

    fs.readFile(Table, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading Lua file');
        }

        try {
            const LuaParsed = luaparse.parse(data);
            const PokemonData = getPokemonData(LuaParsed, PokeName);

            if (PokemonData) {
                res.json(PokemonData); // Send the full tree
            } else {
                res.status(404).send('Pokémon not found in table');
            }
        } catch (parseErr) {
            console.error('Error parsing Lua file:', parseErr);
            res.status(500).send('Error parsing Lua file');
        }
    });
});

// Endpoint to update or add Pokémon data
app.post('/pokemon', (req, res) => {
    const newPokemon = req.body;

    if (!newPokemon.name || !newPokemon.data) {
        return res.status(400).send('Invalid request format. "name" and "data" fields are required.');
    }

    fs.readFile(Table, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading Lua file');
        }

        try {
            const LuaParsed = luaparse.parse(data);
            const pokemons = LuaParsed.body[0].init[0].fields;

            // Check if Pokémon already exists
            let pokemonEntry = pokemons.find(entry => entry.key.name === newPokemon.name);

            if (pokemonEntry) {
                // Update existing Pokémon data
                pokemonEntry.value.fields = Object.keys(newPokemon.data).map(key => ({
                    type: 'tablekey',
                    key: { name: key },
                    value: { type: typeof newPokemon.data[key] === 'number' ? 'number' : 'string', value: newPokemon.data[key] }
                }));
            } else {
                // Add new Pokémon
                pokemons.push({
                    type: 'tablekey',
                    key: { name: newPokemon.name },
                    value: {
                        type: 'tableconstructor',
                        fields: Object.keys(newPokemon.data).map(key => ({
                            type: 'tablekey',
                            key: { name: key },
                            value: { type: typeof newPokemon.data[key] === 'number' ? 'number' : 'string', value: newPokemon.data[key] }
                        }))
                    }
                });
            }

            const LuaStr = JsToLuaString(
                LuaParsed.body[0].init[0].fields.reduce((acc, entry) => {
                    acc[entry.key.name] = entry.value.fields.reduce((obj, field) => {
                        obj[field.key.name] = field.value.value;
                        return obj;
                    }, {});
                    return acc;
                }, {})
            );

            fs.writeFile(Table, LuaStr, 'utf8', (writeErr) => {
                if (writeErr) {
                    return res.status(500).send('Error writing Lua file');
                }
                res.send('Pokémon data saved successfully');
            });
        } catch (parseErr) {
            console.error('Error parsing Lua file:', parseErr);
            res.status(500).send('Error parsing Lua file');
        }
    });
});

// Default route
app.get('/', (req, res) => {
    res.send('Hello, World!');
});

const port = 3000;

app.listen(port, '0.0.0.0', () => {
    console.log(`API is running on http://0.0.0.0:${port}`);
})
