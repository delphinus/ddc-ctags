import { Denops, fn } from "https://deno.land/x/ddc_vim@v0.5.0/deps.ts#^";
import {
  BaseSource,
  Candidate,
} from "https://deno.land/x/ddc_vim@v0.5.0/types.ts#^";
import {
  GatherCandidatesArguments,
  OnInitArguments,
} from "https://deno.land/x/ddc_vim@v0.5.0/base/source.ts#^";

interface Params {
  executable: string;
}

export class Source extends BaseSource {
  private available = false;
  private defaultExecutable = "ctags";

  async onInit({ denops , sourceParams }: OnInitArguments): Promise<void> {
    // old ddc.vim has no sourceParams here
    const executable = sourceParams ?
      sourceParams.executable : this.defaultExecutable;
    if (typeof executable !== "string") {
      await this.print_error(denops, "executable should be a string");
      return;
    }
    if ((await fn.executable(denops, executable)) !== 1) {
      await this.print_error(denops, "executable not found");
      return;
    }
    const help = await this.runCmd([executable, "--help"]);
    this.available = help.length > 0 &&
      /^Universal Ctags/.test(help[0]) &&
      help.some((h) => /--output-format=.*json/.test(h));
    if (!this.available) {
      await this.print_error(
        denops,
        "executable seem not to be the latest Universal Ctags."
      );
    }
  }

  async gatherCandidates({
    denops,
    sourceParams
  }: GatherCandidatesArguments): Promise<Candidate[]> {
    if (!this.available || (await fn.bufname(denops)) === "") {
      return [];
    }
    const file = await fn.expand(denops, '%:p') as string;
    const tags = await this.runCmd([
      sourceParams.executable as string,
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

  params(): Record<string, unknown> {
    return {
      executable: this.defaultExecutable,
    }
  }

  private async runCmd(cmd: string[]): Promise<string[]> {
    const p = Deno.run({ cmd, stdout: "piped" });
    await p.status();
    return new TextDecoder().decode(await p.output()).split(/\n/);
  }

  private async print_error(denops: Denops, message: string): Promise<void> {
    await denops.call("ddc#util#print_error", message, "ddc-ctags")
  }
}
