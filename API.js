// 5:41
const express = require('express');
const fs = require('fs');
const luaparse = require('luaparse');

const app = express();

const Table = './Pokemon.lua';

app.use(express.json());

// Recursive function to parse Lua table fields into a nested object
function parseLuaTable(fields) {
    return fields.reduce((acc, field) => {
        let keyName;

        // Extract the key name
        if (field.key.type === 'identifier') {
            keyName = field.key.name;
        } else if (field.key.type === 'string') {
            keyName = field.key.value;
        } else if (field.key.type === 'numeric') {
            keyName = field.key.value;
        } else {
            return acc; // Skip unsupported key types
        }

        // Extract the value
        switch (field.value.type) {
            case 'tableconstructor':
                acc[keyName] = parseLuaTable(field.value.fields);
                break;
            case 'string':
                acc[keyName] = field.value.value;
                break;
            case 'numeric':
                acc[keyName] = Number(field.value.value);
                break;
            case 'boolean':
                acc[keyName] = field.value.value === 'true';
                break;
            default:
                acc[keyName] = field.value.value || null; // Ensure no undefined values
                break;
        }

        return acc;
    }, {});
}

// Function to get Pokémon data
function getPokemonData(luaTable, name) {
    try {
        const pokemons = luaTable.body[0].init[0].fields;
        const pokemon = pokemons.find(entry => entry.key.name === name || entry.key.value === name);

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
function JsToLuaString(jsobj, indent = 0) {
    const spaces = ' '.repeat(indent);
    const innerSpaces = ' '.repeat(indent + 4);
    let luaStr = '{\n';

    for (let key in jsobj) {
        const value = jsobj[key];
        if (typeof value === 'object' && !Array.isArray(value)) {
            luaStr += `${innerSpaces}["${key}"] = ${JsToLuaString(value, indent + 4)},\n`;
        } else if (Array.isArray(value)) {
            luaStr += `${innerSpaces}["${key}"] = {${value.map(v => `"${v}"`).join(', ')}},\n`;
        } else if (typeof value === 'number') {
            luaStr += `${innerSpaces}["${key}"] = ${value},\n`;
        } else if (typeof value === 'boolean') {
            luaStr += `${innerSpaces}["${key}"] = ${value ? 'true' : 'false'},\n`;
        } else {
            luaStr += `${innerSpaces}["${key}"] = "${value}",\n`;
        }
    }

    luaStr += `${spaces}}`;
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
            let pokemonEntry = pokemons.find(entry => entry.key.name === newPokemon.name || entry.key.value === newPokemon.name);

            if (pokemonEntry) {
                // Update existing Pokémon data
                pokemonEntry.value.fields = Object.keys(newPokemon.data).map(key => ({
                    type: 'tablekey',
                    key: { type: 'string', value: key },
                    value: typeof newPokemon.data[key] === 'number' ? 
                        { type: 'numeric', value: newPokemon.data[key].toString() } :
                        { type: 'string', value: newPokemon.data[key] }
                }));
            } else {
                // Add new Pokémon
                pokemons.push({
                    type: 'tablekey',
                    key: { type: 'string', value: newPokemon.name },
                    value: {
                        type: 'tableconstructor',
                        fields: Object.keys(newPokemon.data).map(key => ({
                            type: 'tablekey',
                            key: { type: 'string', value: key },
                            value: typeof newPokemon.data[key] === 'number' ? 
                                { type: 'numeric', value: newPokemon.data[key].toString() } :
                                { type: 'string', value: newPokemon.data[key] }
                        }))
                    }
                });
            }

            const LuaStr = '_G.Pokemon = ' + JsToLuaString(
                LuaParsed.body[0].init[0].fields.reduce((acc, entry) => {
                    acc[entry.key.name || entry.key.value] = parseLuaTable(entry.value.fields);
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
});
