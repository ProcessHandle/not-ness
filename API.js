const express = require('express');
const fs = require('fs');

const app = express();
const pokemonDataFile = './pokemonData.json';

app.use(express.json());

// Function to get Pokémon data by name
function getPokemonData(name) {
    const pokemonData = JSON.parse(fs.readFileSync(pokemonDataFile, 'utf8'));
    return pokemonData[name] || null;
}

// Function to update or add Pokémon data
function updatePokemonData(newPokemon) {
    const pokemonData = JSON.parse(fs.readFileSync(pokemonDataFile, 'utf8'));
    pokemonData[newPokemon.name] = newPokemon.data;
    fs.writeFileSync(pokemonDataFile, JSON.stringify(pokemonData, null, 4), 'utf8');
}

// Function to edit specific key-value of a Pokémon
function editPokemonData(name, key, value) {
    const pokemonData = JSON.parse(fs.readFileSync(pokemonDataFile, 'utf8'));
    if (pokemonData[name]) {
        pokemonData[name][key] = value;
        fs.writeFileSync(pokemonDataFile, JSON.stringify(pokemonData, null, 4), 'utf8');
        return true;
    }
    return false;
}

// Endpoint to get Pokémon data
app.get('/pokemon/:name', (req, res) => {
    const pokeName = req.params.name;
    const pokemonData = getPokemonData(pokeName);

    if (pokemonData) {
        res.json(pokemonData);
    } else {
        res.status(404).send('Pokémon not found in data');
    }
});

// Endpoint to update or add Pokémon data
app.post('/pokemon', (req, res) => {
    const newPokemon = req.body;

    if (!newPokemon.name || !newPokemon.data) {
        return res.status(400).send('Invalid request format. "name" and "data" fields are required.');
    }

    try {
        updatePokemonData(newPokemon);
        res.send('Pokémon data saved successfully');
    } catch (error) {
        console.error('Error updating Pokémon data:', error);
        res.status(500).send('Error updating Pokémon data');
    }
});

// Endpoint to edit specific key-value of a Pokémon
app.put('/pokemon/:name', (req, res) => {
    const pokeName = req.params.name;
    const { key, value } = req.body;

    if (!key || value === undefined) {
        return res.status(400).send('Invalid request format. "key" and "value" fields are required.');
    }

    try {
        const updated = editPokemonData(pokeName, key, value);
        if (updated) {
            res.send('Pokémon data updated successfully');
        } else {
            res.status(404).send('Pokémon not found in data');
        }
    } catch (error) {
        console.error('Error editing Pokémon data:', error);
        res.status(500).send('Error editing Pokémon data');
    }
});

// Default route
app.get('/', (req, res) => {
    res.send('Hello, World!');
});

const port = 3000;

app.listen(port, '0.0.0.0', () => {
    console.log(`API is running on http://0.0.0.0:${port}`);
});
