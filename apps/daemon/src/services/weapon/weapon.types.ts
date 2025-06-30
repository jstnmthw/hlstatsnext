export interface IWeaponService {
  getWeaponModifier(game: string, code: string): Promise<number | null>
  getSkillMultiplier(game: string | undefined, weapon: string): Promise<number>
  getDamageMultiplier(weapon: string, headshot: boolean): Promise<number>
  clearCache(): void
  getCacheSize(): number
}
