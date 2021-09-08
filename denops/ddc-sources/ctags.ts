import { Denops, fn, op } from "https://deno.land/x/ddc_vim@v0.5.0/deps.ts#^";
import {
  BaseSource,
  Candidate,
} from "https://deno.land/x/ddc_vim@v0.5.0/types.ts#^";
import {
  GatherCandidatesArguments,
  OnInitArguments,
} from "https://deno.land/x/ddc_vim@v0.5.0/base/source.ts#^";
import * as path from "https://deno.land/std@0.106.0/path/mod.ts#^";

interface Params {
  executable: string;
}

interface Ctag {
  name: string;
  kind?: string;
  scope?: string;
  scopeKind?: string;
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
    const help = await this.runCmd(denops, [executable, "--help"]);
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
    const cwd = (await fn.getcwd(denops)) as string
    const exts = (await op.suffixesadd.get(denops)) || path.extname(file);
    const files = await this.findFiles(denops, cwd, exts)
    const tags = await this.runCmd(denops, [
      sourceParams.executable as string,
      "--output-format=json",
      "--fields={name}{kind}{scope}{scopeKind}",
      "-u",
      ...(files.length > 0 ? files : [file]),
    ]);
    await denops.cmd(`echomsg 'lines: ${tags.length}'`)
    return tags.reduce<Candidate[]>((a, b) => {
      if (/^\{.*\}$/.test(b)) {
        let c: Ctag | undefined
        try {
          c = JSON.parse(b)
        } catch { }
        if (c) {
          const candidate: Candidate = {
            word: c.name,
            kind: c.kind,
          }
          if (c.scope && c.scopeKind) {
            candidate.menu = `${c.scope} [${c.scopeKind}]`
          }
          a.push(candidate)
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

  private async runCmd(denops: Denops, cmd: string[]): Promise<string[]> {
    await denops.cmd(`echomsg '${cmd.join(" ")}'`)
    const p = Deno.run({ cmd, stdout: "piped" });
    await p.status();
    return new TextDecoder().decode(await p.output()).split(/\n/);
  }

  private async findFiles(
      denops: Denops,
      cwd: string,
      exts: string
  ): Promise<string[]> {
    const inameOptions = exts.split(/,/).reduce<string[]>((a, b) => {
      if (a.length > 0) {
        a.push("-o");
      }
      a.push("-iname", `*${b}`);
      return a;
    }, [])
    const files = await this.runCmd(denops, [
      "find", cwd, "-type", "f",
      //"(", "!", "-regex", `/\..*`, ")",
      "(", ...inameOptions, ")",
    ]);
    return files.filter((f) => f.length > 0)
  }

  private async print_error(denops: Denops, message: string): Promise<void> {
    await denops.call("ddc#util#print_error", message, "ddc-ctags")
  }
}
