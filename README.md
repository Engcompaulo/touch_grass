*This is a submission for the [Hacktoberfest Weekend Challenge: Build for a Friend](https://dev.to/challenges/hacktoberfest-weekend-2026-10-01)*

## What I Built

The **Board Game Scoreboard** is an interactive electronic scoreboard for board game nights, built for Challenge 2 of Hacktoberfest 2026 with the "Touch Grass" theme (getting people off their screens and into the real world playing together). I made it for my group of friends, who get together to play Uno, dominoes, checkers, and cards, but always waste time arguing over which game to start with and jotting points on scraps of paper that get lost in the mess. The app solves that by organizing the session into simple steps and keeping the scoreboard for the whole night: the group checks off the games they own, registers the players, sets how much each game is worth, records the results as matches wrap up, and, at the end, determines the Winner of the Day complete with a certificate. The approach is deliberately minimalist about screen time: the app is just the organizer and the scoreboard, so the focus stays on the real game, at the table, among people.

## Demo

There's no public deployment, because the project is meant to run entirely on the group's own machine, without relying on the internet. To try it out, just clone the repository, go into the `touch_grass` folder, and bring everything up with `docker compose up`: in a few seconds the frontend is available at `http://localhost:8080` and the local AI service responds at `http://localhost:11434`. From there, just follow the six steps right in the interface, in English. _(Placeholder for a short video demonstrating a game night end to end.)_

## Code

The full source code is in the `touch_grass` directory of this repository. The frontend is plain JavaScript (ES modules), HTML, and CSS, organized into pure-logic modules (`validation`, `catalog`, `players`, `scoring`, `suggestion`, `scoreboard`, `results`, `state`) along with tests using Vitest and fast-check. The runtime infrastructure lives in the `Dockerfile` and `docker-compose.yml`, which define exactly two services: the frontend and the AI service.

## How I Built It

The core piece that makes the project work is an open-source AI: a lightweight open-weight model (for example, `llama3.2`) served by **Ollama**, running locally in a Docker container alongside the frontend. From the games the group selected and the number of people present, the app builds a prompt and asks the model for a suggested order of matches for the night. The whole project is built around that suggestion, but with **graceful degradation** as a design principle: if Ollama is unavailable, slow, or returns an error, the app cancels the call after a timeout and falls back to a sequence generated locally in JavaScript that covers each selected game at least once. That way, the AI's intelligence enriches the experience when it's available, and the local fallback ensures game night never stalls because of it.

## Why Does Open Innovation Matter?

The open-source approach works best here precisely because game night happens at someone's living room table, often without reliable internet. With an open-weight model running locally via Ollama, the app keeps working offline, without depending on any external API. The session data — player names, games, and scores — stays in the browser's `localStorage` and in the calls to the local service, remaining on the user's machine instead of traveling to third-party servers, which preserves the group's privacy. And since there's no closed API in the way, there's no per-request cost or usage limits: anyone can spin up the project and use it freely. A closed API wouldn't make this possible without a permanent connection, without cost, and without giving up data privacy.
