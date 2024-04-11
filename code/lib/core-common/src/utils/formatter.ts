import semver from 'semver';
import dedent from 'ts-dedent';

type Prettier = typeof import('prettier-v2') | typeof import('prettier-v3');
type PrettierVersion = 2 | 3;

let prettierInstance: Prettier | undefined;
let prettierVersion: 2 | 3 | null = null;

const getPrettier = async (): Promise<
  | { instance: undefined; version: null }
  | { instance: typeof import('prettier-v2'); version: 2 }
  | { instance: typeof import('prettier-v3'); version: 3 }
> => {
  if (!prettierInstance) {
    try {
      prettierInstance = (await import('prettier')) as unknown as Prettier | undefined;
      prettierVersion = prettierInstance?.version
        ? (semver.major(prettierInstance.version) as PrettierVersion)
        : null;

      return {
        version: prettierVersion,
        instance: prettierInstance,
      } as any;
    } catch (err) {
      return {
        instance: undefined,
        version: null,
      };
    }
  }

  return {
    instance: prettierInstance,
    version: prettierVersion,
  } as any;
};

/**
 * Format the content of a file using prettier.
 * If prettier is not available in the user's project, it will fallback to use editorconfig settings if available and formats the file by a prettier-fallback.
 */
export async function formatFileContent(filePath: string, content: string): Promise<string> {
  try {
    const prettier = await getPrettier();

    switch (prettier.version) {
      case 2:
      case 3:
        const config = await prettier.instance.resolveConfig(filePath);

        if (!config || Object.keys(config).length === 0) {
          return await formatWithEditorConfig(filePath, content);
        }

        const result = await prettier.instance.format(content, {
          ...(config as any),
          filepath: filePath,
        });

        return result;
      case null:
      case undefined:
        return await formatWithEditorConfig(filePath, content);
      default:
        console.warn(dedent`
        Your prettier version ${
          (prettier as any).version
        } is not supported to format files which were edited by Storybook. 
        Please raise an issue on the Storybook GitHub repository. 
        Fallback to EditorConfig settings if available.
        `);
    }
  } catch (error) {
    return content;
  }

  return content;
}

async function formatWithEditorConfig(filePath: string, content: string) {
  const prettier = await import('prettier-fallback');
  const config = await prettier.resolveConfig(filePath, { editorconfig: true });

  if (!config || Object.keys(config).length === 0) {
    return content;
  }

  return prettier.format(content, {
    ...(config as any),
    filepath: filePath,
  });
}
