const fs = require('fs')
const path = require('path')
const { withDangerousMod } = require('expo/config-plugins')

/**
 * App Store Connect only accepts builds made with Xcode 26 or later, and two parts of this
 * SDK 52 project do not compile there. Both are patched while the native project is
 * generated, so EAS builds them the same way without an ios/ folder in the repo.
 *
 * 1. fmt 11 (pulled in by React Native 0.76) relies on consteval, which Xcode 26's clang
 *    rejects ("call to consteval function ... is not a constant expression"). After pod
 *    install the fmt headers are told consteval is unavailable, which falls back to runtime
 *    format checking.
 * 2. expo-localization 16 switches over Calendar.Identifier without a default, and the
 *    iOS 26 SDK added cases (.bangla, .gujarati, ...), so the switch is no longer
 *    exhaustive. A default returning "gregory" covers the calendars it does not know.
 */
const FMT_MARKER = '# fmt consteval fix'

const FMT_PATCH = `
    ${FMT_MARKER}: fmt 11 does not compile on Xcode 26's clang.
    Dir.glob(File.join(installer.sandbox.root, '**', 'fmt', '**', '*.{h,cc}')).each do |file|
      source = File.read(file)
      patched = source.gsub('FMT_USE_CONSTEVAL 1', 'FMT_USE_CONSTEVAL 0').gsub('#elif defined(__cpp_consteval)', '#elif 0')
      next if patched == source
      File.chmod(0644, file)
      File.write(file, patched)
    end
`

const CALENDAR_SWITCH_END = '    case .iso8601:\n      return "iso8601"\n    }'
const CALENDAR_DEFAULT = '    case .iso8601:\n      return "iso8601"\n    default:\n      return "gregory"\n    }'

function patchPodfile(platformProjectRoot) {
  const podfile = path.join(platformProjectRoot, 'Podfile')
  let contents = fs.readFileSync(podfile, 'utf8')
  if (contents.includes(FMT_MARKER)) return
  contents = contents.replace(/post_install do \|installer\|\n/, (m) => m + FMT_PATCH)
  if (!contents.includes(FMT_MARKER)) throw new Error('withXcode26Fixes: post_install block not found in Podfile')
  fs.writeFileSync(podfile, contents)
}

function patchLocalization(projectRoot) {
  const pkg = require.resolve('expo-localization/package.json', { paths: [projectRoot] })
  const file = path.join(path.dirname(pkg), 'ios', 'LocalizationModule.swift')
  const source = fs.readFileSync(file, 'utf8')
  if (source.includes(CALENDAR_DEFAULT)) return
  if (!source.includes(CALENDAR_SWITCH_END)) throw new Error('withXcode26Fixes: calendar switch not found in expo-localization')
  fs.writeFileSync(file, source.replace(CALENDAR_SWITCH_END, CALENDAR_DEFAULT))
}

module.exports = function withXcode26Fixes(config) {
  return withDangerousMod(config, [
    'ios',
    async (cfg) => {
      patchPodfile(cfg.modRequest.platformProjectRoot)
      patchLocalization(cfg.modRequest.projectRoot)
      return cfg
    },
  ])
}
