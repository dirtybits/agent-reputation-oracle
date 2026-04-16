#!/usr/bin/env node

import { buildProgram } from "./cli.js";

await buildProgram().parseAsync(process.argv);
