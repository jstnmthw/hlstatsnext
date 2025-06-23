export function hello(): string {
  return "Hello HLStatsDaemon";
}

// If executed directly (e.g., pnpm dev), log the greeting
// if (import.meta.url === `file://${process.argv[1]}`) {
//   console.log(hello());
// }
