const express = require('express');
const fs = require('fs');

const app = express();
const port = 3000; // Ensure the API listens on port 3000
const Table = './Pokemon.lua';

app.use(express.json());

// Custom Lua parser to handle tables, including nested structures
function parseLuaTable(luaString) {
    const table = {};

    // Regular expression to match Lua key-value pairs
    const tableRegex = /\["?([\w\s]+)"?\]\s*=\s*({|".*?"|[\d.]+|true|false|null)/g;
    let match;

    while ((match = tableRegex.exec(luaString)) !== null) {
        const key = match[1]; // Key name
        const value = match[2]; // Value (nested table, string, number, etc.)

        if (value === '{') {
            // Nested table
            const nestedTableContent = extractNestedTable(luaString, tableRegex.lastIndex);
            table[key] = parseLuaTable(nestedTableContent);
        } else if (value.startsWith('"')) {
            // String value
            table[key] = value.slice(1, -1);
        } else if (!isNaN(Number(value))) {
            // Numeric value
            table[key] = Number(value);
        } else if (value === 'true' || value === 'false') {
            // Boolean value
            table[key] = value === 'true';
        } else {
            // Fallback for unsupported or unrecognized values
            table[key] = "N/A";
        }
    }

    return table;
}

// Extract the content of a nested Lua table
function extractNestedTable(luaString, startIndex) {
    let openBraces = 1;
    let endIndex = startIndex;

    while (openBraces > 0 && endIndex < luaString.length) {
        const char = luaString[endIndex];
        if (char === '{') {
            openBraces++;
        } else if (char === '}') {
            openBraces--;
        }
        endIndex++;
    }

    return luaString.slice(startIndex, endIndex - 1); // Return content within braces
}

// Fetch Pokémon data from Lua file
function fetchPokemonData(luaString, pokemonName) {
    const allData = parseLuaTable(luaString);
    return allData[pokemonName] || null; // Return the specific Pokémon's data
}

// Endpoint to fetch Pokémon data as a Lua-style table
app.get('/pokemon/:name', (req, res) => {
    const PokeName = req.params.name;

    fs.readFile(Table, 'utf8', (err, data) => {
        if (err) {
            return res.status(500).send('Error reading Lua file');
        }

        const pokemonData = fetchPokemonData(data, PokeName);

        if (pokemonData) {
            res.setHeader('Content-Type', 'text/plain');
            res.send(`return ${formatLuaTable(pokemonData)}`); // Return Lua-style table
        } else {
            res.status(404).send(`❌ Pokémon '${PokeName}' not found.`);
        }
    });
});

// Helper function to format JavaScript objects into Lua-style tables
function formatLuaTable(obj) {
    if (Array.isArray(obj)) {
        // Handle arrays
        return `{ ${obj.map(formatLuaTable).join(', ')} }`;
    } else if (typeof obj === 'object' && obj !== null) {
        // Handle nested objects
        const fields = Object.entries(obj)
            .map(([key, value]) => `["${key}"] = ${formatLuaTable(value)}`)
            .join(', ');
        return `{ ${fields} }`;
    } else if (typeof obj === 'string') {
        // Handle strings
        return `"${obj}"`;
    } else if (typeof obj === 'number' || typeof obj === 'boolean') {
        // Handle numbers and booleans
        return obj.toString();
    } else {
        // Fallback for unsupported types
        return "nil";
    }
}

// Default route
app.get('/', (req, res) => {
    res.send('Hello, World! The Pokémon API is running.');
});

// Start the server and bind it to all interfaces
app.listen(port, '0.0.0.0', () => {
    console.log(`API is running on http://0.0.0.0:${port}`);
});
