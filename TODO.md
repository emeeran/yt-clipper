# YT-Clipper Task List

## 🔴 Critical (Immediate)

### TypeScript Type Safety
- [ ] Fix `youtube-url-modal.ts` - Add null checks for ~20 "Object is possibly 'undefined'" errors
- [ ] Fix `ai-service.ts:338` - Type assignment `string | undefined` to `string`
- [ ] Fix `service-container.ts:343,351` - Interface type mismatches for metrics
- [ ] Fix `service-container.ts:359` - Missing `cacheMetrics` property
- [ ] Fix `prompt-service.ts:96` - Overload matching error
- [ ] Fix `memory-cache.ts:193` - Parameter type mismatch
- [ ] Fix `performance-tracker.ts:188-189` - Undefined checks for `extreme`
- [ ] Fix `transcript-service.ts:153-155,299` - Undefined checks for `element` and `segment`

### Failing Tests
- [ ] Fix `modal-manager.test.ts` - `isModalOpen()` returning wrong state after close
- [ ] Fix `modal-manager.test.ts` - Error handling in close operations
- [ ] Review and update all 9 failing test cases

### ESLint Configuration
- [ ] Install missing `@typescript-eslint/eslint-plugin` or update config
- [ ] Verify `.eslintrc.js` extends correct configs
- [ ] Run `npm run lint` to confirm fix

---

## 🟡 Medium Priority (Short-term)

### Settings Tab UX Improvements
- [ ] Change `'Gemi'` to `'Gemini API Key'`
- [ ] Change `'Groq'` to `'Groq API Key'`  
- [ ] Change `'Ollm'` to `'Ollama API Key'`
- [ ] Change `'Perf'` to `'Performance Mode'`
- [ ] Change `'MM-Audio'` to `'Multimodal Audio Analysis'`
- [ ] Change `'Parallel'` to `'Parallel Processing'`
- [ ] Expand abbreviated step labels in Quick Start section

### Documentation
- [ ] Fix/restore root `README.md` with proper content
- [ ] Add installation instructions
- [ ] Add configuration guide with screenshots
- [ ] Document API key setup process
- [ ] Add usage examples with GIFs/videos

### Code Quality
- [ ] Extract theme checking logic to shared utility
- [ ] Extract style application code to reduce duplication
- [ ] Add JSDoc comments to public methods missing documentation
- [ ] Remove unused imports across codebase

---

## 🟢 Low Priority (Long-term)

### Testing
- [ ] Add unit tests for `GeminiProvider`
- [ ] Add unit tests for `GroqProvider`
- [ ] Add unit tests for `OllamaProvider`
- [ ] Add integration tests for video processing flow
- [ ] Add integration tests for file creation
- [ ] Increase test coverage to >80%

### Chrome Extension
- [ ] Document Chrome extension setup process
- [ ] Add Chrome extension installation guide
- [ ] Test extension-to-plugin communication

### Performance
- [ ] Add request deduplication for concurrent API calls
- [ ] Implement request queue with priority
- [ ] Add offline mode with cached responses
- [ ] Profile and optimize memory usage

### Features
- [ ] Add batch processing for multiple videos
- [ ] Add playlist support
- [ ] Add video timestamp linking in notes
- [ ] Add custom template creation UI
- [ ] Add export options (PDF, HTML)

### Security
- [ ] Add API key rotation reminders
- [ ] Implement key validation on startup
- [ ] Add security audit logging
- [ ] Consider adding rate limit tracking per provider

---

## 📋 Version Checklist (Before Release)

- [ ] All TypeScript errors resolved (`npm run type-check` passes)
- [ ] All tests passing (`npm test` shows 0 failures)
- [ ] Linting passes (`npm run lint` shows no errors)
- [ ] Build succeeds (`npm run build` completes)
- [ ] Manual testing completed
- [ ] CHANGELOG.md updated
- [ ] Version bumped in `manifest.json` and `package.json`
- [ ] Documentation reviewed

---

## 📝 Notes

- Current version: 1.3.5
- Test status: 18 passed / 9 failed (27 total)
- TypeScript errors: ~30+
- Total source lines: ~17,188

---

*Last updated: December 6, 2025*
