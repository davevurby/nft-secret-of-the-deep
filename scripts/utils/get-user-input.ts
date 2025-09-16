import * as readline from "node:readline";

/**
 * Get user input from the console.
 * 
 * This function is used to get user input from the console.
 * 
 * @example ```ts 
 * const input = await getUserInput("Enter your name: ");
 * console.log(`Hello, ${input}!`);
 * ```
 * 
 * @param prompt - The prompt to display to the user
 * @returns The user's input as a string
 */
export async function getUserInput(prompt: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
  
    return new Promise((resolve) => {
        rl.question(prompt, (answer) => {
            rl.close();
            resolve(answer.trim());
        });
    });
}