// Shared helpers for Admin's "create a working @routehub.local login"
// shortcut - used both when creating a new beta-tester company and when
// adding an extra test user (any role) to a branch that already exists.
export function slugify(value: string) {
  return value.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'company'
}

export function randomPassword() {
  // Readable-enough to copy by hand, random enough not to matter that it's a
  // test account - the tester can change it from Settings right after.
  const bytes = new Uint8Array(9)
  crypto.getRandomValues(bytes)
  return btoa(String.fromCharCode(...bytes)).replace(/[+/=]/g, '').slice(0, 12)
}
