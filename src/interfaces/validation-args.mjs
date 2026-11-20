export function parseValidationArguments(args) {
  const files = [], rules = [];
  let configurationFile, positionalOnly = false;
  for (let i = 0; i < args.length; i++) {
    const value = args[i];
    if (!positionalOnly && value === '--') { positionalOnly = true; continue; }
    if (!positionalOnly && value.startsWith('--')) {
      const equal = value.indexOf('=');
      const flag = equal < 0 ? value : value.slice(0, equal);
      if (!['--rules', '--rules-config'].includes(flag)) throw new Error(`未対応のオプションです: ${flag}`);
      const argument = equal < 0 ? args[++i] : value.slice(equal + 1);
      if (!argument || argument.startsWith('--')) throw new Error(`${flag} の値が必要です`);
      if (flag === '--rules') rules.push(argument);
      else { if (configurationFile !== undefined) throw new Error('--rules-config は1回だけ指定してください'); configurationFile = argument; }
    } else files.push(value);
  }
  if (!files.length) throw new Error('diagram-desk validate <file> [file ...] [--rules <id>] [--rules-config <file>]');
  if (configurationFile && !rules.length) throw new Error('--rules-config を使用するときは --rules も指定してください');
  return { files, rules: [...new Set(rules)], configurationFile };
}
