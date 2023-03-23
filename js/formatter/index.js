import sampleJSON from './samples.json' assert { type: "json" };

import { LavendeuxFormatter } from './lavendeux.js';
import { JavascriptFormatter } from './javascript.js';
import { JSONSample } from './sample.js';

export { Formatter } from './formatter.js';
export { JSONSample } from './sample.js';
export { LavendeuxFormatter } from './lavendeux.js';
export { JavascriptFormatter } from './javascript.js';

export const FormatterInstances = {
	lavendeux: new LavendeuxFormatter(),
	javascript: new JavascriptFormatter(),
};
FormatterInstances.get = name => ((name in FormatterInstances)
	? FormatterInstances[name]
	: FormatterInstances.lavendeux);

/**
 * Get all sample data
 * @returns All JSON formatted samples
 */
export function getAllSamples() {
	return JSONSample.allFromJSON(sampleJSON);
}

/**
 * Format all sample data
 * @returns All HTML formatted samples
 */
export function getAllFormattedSamples() {
	return getAllSamples().map(s => s.toHTML(
		FormatterInstances.get(s.formatter),
	));
}

/**
 * Format all sample data
 * @returns All HTML formatted samples
 */
export function getSampleHTML() {
	return getAllFormattedSamples().join('\n');
}

/**
 * Get code example
 * @returns Code example
 */
export function getExampleSample() {
	return sampleJSON.example.join('\n');
}
