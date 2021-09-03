import { fn } from "https://deno.land/x/ddc_vim@v0.4.1/deps.ts#^";
import {
  BaseSource,
  Candidate,
} from "https://deno.land/x/ddc_vim@v0.4.1/types.ts#^";
import {
  GatherCandidatesArguments,
  OnInitArguments,
} from "https://deno.land/x/ddc_vim@v0.4.1/base/source.ts#^";

export class Source extends BaseSource {
  private available = false;

  async onInit({ denops }: OnInitArguments): Promise<void> {
    const hasExecutable = (await fn.executable(denops, "ctags")) === 1;
    let hasJson = false
    if (hasExecutable) {
        const help = await this.runCmd(["ctags", "--help"]);
        hasJson = help.some((h) => /--output-format=.*json/.test(h));
    }
    this.available = hasExecutable && hasJson;
  }

  async gatherCandidates({
    denops,
  }: GatherCandidatesArguments): Promise<Candidate[]> {
    const isNamedBuf = (await fn.bufname(denops)) !== ""
    if (!this.available || !isNamedBuf) {
      return [];
    }
    const file = await fn.expand(denops, '%:p') as string;
    const tags = await this.runCmd([
      "ctags",
      "--output-format=json",
      "--fields={name}",
      "-u",
      file,
    ]);
    return tags.reduce<Candidate[]>((a, b) => {
      if (/^\{.*\}$/.test(b)) {
        let decoded: { name: string; } | undefined
        try {
          decoded = JSON.parse(b)
        } catch { }
        if (decoded) {
          a.push({ word: decoded.name })
        }
      }
      return a
    }, []);
  }

  private async runCmd(cmd: string[]): Promise<string[]> {
    const p = Deno.run({ cmd, stdout: "piped" });
    await p.status();
    return new TextDecoder().decode(await p.output()).split(/\n/);
  }
}
