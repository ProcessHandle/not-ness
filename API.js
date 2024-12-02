const express = require('express');
const fs = require('fs');
const luaparse = require('luaparse');

const app = express();
const port = 3000; // Ensure the API listens on port 3000
const Table = './Pokemon.lua';

app.use(express.json());

// Recursive function to parse Lua tables, including nested structures and arrays
function parseLuaTable(fields) {
    return fields.reduce((acc, field) => {
        const keyName = field.key.type === 'string' ? field.key.value : field.key.name; // Handle string or name keys
        const value = field.value;

        if (value.type === 'tableconstructor') {
            // Recursively parse nested tables
            acc[keyName] = parseLuaTable(value.fields);
        } else if (value.type === 'string') {
            // Handle strings
            acc[keyName] = value.value;
        } else if (value.type === 'number') {
            // Handle numbers
            acc[keyName] = value.value;
        } else if (Array.isArray(value)) {
            // Handle arrays
            acc[keyName] = value.map(item => (item.type === 'tableconstructor' ? parseLuaTable(item.fields) : item.value));
        } else {
            // Unsupported types (fallback to "N/A")
            acc[keyName] = "N/A";
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

// Default route
app.get('/', (req, res) => {
    res.send('Hello, World! The Pokémon API is running.');
});

// Start the server and bind it to all interfaces
app.listen(port, '0.0.0.0', () => {
    console.log(`API is running on http://0.0.0.0:${port}`);
});
