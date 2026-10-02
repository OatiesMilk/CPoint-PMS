import bcrypt from "bcryptjs";

// Cost 12 ≈ 200–300 ms per hash on a laptop: slow enough to resist brute force, fast enough to sign in.
const COST = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** A real hash of a random string, compared against when the email is unknown so timing stays equal. */
export const DUMMY_HASH = "$2b$12$EJAxRxVJVxUWskEbKTQjy.FIqyQtVp3uxadYszM26WvtK9C64Ga.6";
