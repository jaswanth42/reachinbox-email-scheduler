import { testIndexEmail } from "./services/email.search.js";

async function main() {
	await testIndexEmail();
	console.log("Test completed");
}

void main();