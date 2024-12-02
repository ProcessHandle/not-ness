// take fucking 20
const express = require('express');
const fs = require('fs');
const luaparse = require('luaparse');

const app = express();
const port = 3000;
const Table = './Pokemon.lua';

app.use(express.json());

// Recursive function to parse Lua fields, including nested structures
function parseLuaTable(fields) {
    return fields.reduce((acc, field) => {
        const key = field.key.type === 'identifier' ? field.key.name : field.key.value; // Handle keys
        const value = field.value;

        if (value.type === 'tableconstructor') {
            // Recursively parse nested tables
            acc[key] = parseLuaTable(value.fields);
        } else if (value.type === 'string') {
            // Handle strings
            acc[key] = value.value;
        } else if (value.type === 'numericliteral') {
            // Handle numbers
            acc[key] = value.value;
        } else {
            // Unsupported value types
            acc[key] = "N/A";
        }
        return acc;
    }, {});
}

// Function to extract Pokémon data by name
function getPokemonData(luaTable, name) {
    try {
        const pokemons = luaTable.body[0].init[0].fields; // Top-level Lua table
        const pokemonEntry = pokemons.find(entry => entry.key.name === name);

        if (pokemonEntry) {
            return parseLuaTable(pokemonEntry.value.fields); // Parse the full Pokémon data
        }
        return null; // Pokémon not found
    } catch (error) {
        console.error('Error parsing Lua table:', error);
        return null;
    }
}

// Endpoint to fetch Pokémon data
app.get('/pokemon/:name', (req, res) => {
    const PokeName = req.params.name;

    fs.readFile(Table, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading Lua file.');
        }

        try {
            const luaParsed = luaparse.parse(data); // Parse the Lua file
            const pokemonData = getPokemonData(luaParsed, PokeName);

            if (pokemonData) {
                res.json(pokemonData); // Return the parsed data
            } else {
                res.status(404).send(`❌ Pokémon '${PokeName}' not found.`);
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

// Start the server
app.listen(port, '0.0.0.0', () => {
    console.log(`API is running on http://0.0.0.0:${port}`);
});
