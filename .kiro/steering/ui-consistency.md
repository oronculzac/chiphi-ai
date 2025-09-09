# UI Consistency and Visual Standards

## Tailwind CSS Requirements
- Always verify Tailwind configuration before implementing UI changes
- Use shadcn/ui components as the foundation for all UI elements
- Implement visual regression testing for critical UI components
- Maintain design system consistency across all pages

## Component Development Patterns
- Create reusable components in `components/` directory
- Use TypeScript interfaces for all component props
- Implement proper accessibility (ARIA labels, keyboard navigation)
- Test components in isolation using Playwright MCP + shadcn MCP integration

### Chart and Data Visualization Patterns
- **Recharts Integration**: Use Recharts for all chart components (donut, line, area charts)
- **Loading States**: Implement skeleton loaders for chart components during data fetching
- **Empty States**: Provide meaningful empty states with actionable suggestions
- **Interactive Elements**: Ensure chart interactions (click-to-filter) are keyboard accessible
- **Responsive Design**: Charts must adapt to different screen sizes and orientations
- **Color Accessibility**: Use colorblind-friendly palettes and don't rely solely on color

### MCP-First Component Development Workflow
1. **Discovery**: Use shadcn MCP `search-components` to find suitable base components
2. **Installation**: Use shadcn MCP `add-component` to install required components
3. **Development**: Create custom components extending shadcn/ui patterns
4. **Testing**: Use Playwright MCP for automated component testing
5. **Validation**: Use Playwright MCP `browser_snapshot` for accessibility verification
6. **Documentation**: Use Playwright MCP to generate component usage examples

## Visual Testing Strategy
- Run visual regression tests on every UI change
- Use 1% threshold for visual difference detection
- Create baseline screenshots for all major UI components
- Test across multiple browsers and viewport sizes

## MCP-Driven UI/UX Testing and Development

### Playwright MCP for UI Testing
- **Primary tool for all UI/UX testing and validation**
- Use `browser_navigate` to test page routing and navigation flows
- Use `browser_snapshot` for accessibility-focused testing (better than screenshots)
- Use `browser_click`, `browser_fill`, `browser_select` for interaction testing
- Use `browser_evaluate` to verify computed styles and DOM properties
- Use `browser_take_screenshot` for visual regression baseline creation

### shadcn MCP for Component Development
- **Primary tool for UI component generation and management**
- Use `getAllComponents` to audit existing component library
- Use `getComponent` to retrieve specific component implementations
- Use `add-component` to install new shadcn/ui components
- Use `search-components` to find appropriate components for new features
- Integrate shadcn MCP with Playwright MCP for end-to-end component testing

### MCP Integration Workflow
```typescript
// Example: Test new component with MCP integration
1. Use shadcn MCP to add/retrieve component
2. Use Playwright MCP to navigate to component test page
3. Use Playwright MCP to verify component renders correctly
4. Use Playwright MCP to test component interactions
5. Use Playwright MCP to capture visual regression baselines
```

### UI/UX Testing Patterns with MCP
- **Component Testing**: Use shadcn MCP + Playwright MCP for isolated component testing
- **Integration Testing**: Use Playwright MCP for full page interaction flows
- **Visual Regression**: Use Playwright MCP screenshots with automated comparison
- **Accessibility Testing**: Use Playwright MCP snapshots for screen reader compatibility
- **Cross-browser Testing**: Use Playwright MCP across multiple browser engines

## Style Debugging
- Use `/debug` page for style probe testing
- Verify computed styles programmatically with Playwright MCP `browser_evaluate`
- Monitor CSS bundle size and loading performance
- Implement style health checks in CI pipeline using MCP automation

## Tailwind v4 Configuration
- Ensure `postcss.config.mjs` includes `@tailwindcss/postcss` plugin
- Verify `globals.css` imports Tailwind directives properly
- Use `tailwind.config.ts` for theme customization and content paths
- Test CSS compilation in build process

## shadcn/ui Integration
- Follow shadcn/ui component patterns for consistency
- Use Radix UI primitives as the foundation
- Maintain proper component composition patterns
- Test component variants and states

## Accessibility Standards
- Implement ARIA labels for all interactive elements
- Ensure keyboard navigation works for all components
- Test with screen readers and accessibility tools
- Maintain proper color contrast ratios

## Performance Considerations
- Monitor CSS bundle size and loading times
- Use CSS-in-JS sparingly to avoid runtime overhead
- Implement proper code splitting for component libraries
- Test performance impact of style changes