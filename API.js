const express = require('express');
const fs = require('fs');
const luaparse = require('luaparse');

const app = express();
const port = 3000; // Ensure the API listens on port 3000
const Table = './Pokemon.lua';

app.use(express.json());

// Recursive function to parse the full Lua table with advanced type handling
function parseLuaTable(fields) {
    return fields.reduce((acc, field) => {
        if (field.value.type === 'tableconstructor') {
            // Recursively parse nested tables
            acc[field.key.name] = parseLuaTable(field.value.fields);
        } else {
            const value = field.value.value;

            // Handle strings
            if (typeof value === 'string') {
                acc[field.key.name] = value;

            // Handle numbers (keep all unless explicitly 0 or invalid)
            } else if (typeof value === 'number') {
                acc[field.key.name] = value === 0 ? "N/A" : value;

            // Handle unsupported or unknown types
            } else {
                acc[field.key.name] = "N/A";
            }
        }
        return acc;
    }, {});
}

// Function to get detailed Pokémon data
function getPokemonData(luaTable, name) {
    try {
        const pokemons = luaTable.body[0].init[0].fields; // Top-level table
        const pokemon = pokemons.find(entry => entry.key.name === name); // Find the specific Pokémon

        if (pokemon) {
            return parseLuaTable(pokemon.value.fields); // Parse and return the entire tree
        }
        return null;
    } catch (error) {
        console.error('Error parsing Lua table structure:', error);
        return null;
    }
}

// Endpoint to fetch Pokémon data
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
                res.json(PokemonData); // Return the full tree of Pokémon data
            } else {
                res.status(404).send(`❌ Pokémon '${PokeName}' not found in the database.`);
            }
        } catch (parseErr) {
            console.error('Error parsing Lua file:', parseErr);
            res.status(500).send('Error parsing Lua file.');
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

            // Convert updated data back to Lua string format
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
                res.send('✅ Pokémon data saved successfully.');
            });
        } catch (parseErr) {
            console.error('Error parsing Lua file:', parseErr);
            res.status(500).send('Error parsing Lua file.');
        }
    });
});

app.get('/', (req, res) => {
    res.send('Hello, World! The Pokémon API is running.');
});

app.listen(port, '0.0.0.0', () => {
    console.log(`API is running on http://0.0.0.0:${port}`);
});

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
                luaStr += `        ${key} = ${JsToLuaString(value)},\n`; 
            }
        }
        luaStr += '    },\n';
    }
    luaStr += '}\n';
    return luaStr;
}
