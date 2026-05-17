import { createContext, useContext, useEffect, useState } from 'react'

const THEMES = ['minimalist-light', 'minimalist-dark', 'cinematic-light', 'cinematic-dark']
const TYPOGRAPHIES = ['editorial', 'silver-screen']

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(
    () => localStorage.getItem('ra-theme') || 'minimalist-light'
  )
  const [typography, setTypographyState] = useState(
    () => localStorage.getItem('ra-typography') || 'editorial'
  )

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('ra-theme', theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-typography', typography)
    localStorage.setItem('ra-typography', typography)
  }, [typography])

  // Apply defaults on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    document.documentElement.setAttribute('data-typography', typography)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function setTheme(t) {
    if (THEMES.includes(t)) setThemeState(t)
  }

  function setTypography(t) {
    if (TYPOGRAPHIES.includes(t)) setTypographyState(t)
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, typography, setTypography, THEMES, TYPOGRAPHIES }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
