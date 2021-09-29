import { Denops, fn } from "https://deno.land/x/ddc_vim@v0.14.0/deps.ts#^";
import {
  BaseSource,
  Candidate,
} from "https://deno.land/x/ddc_vim@v0.14.0/types.ts#^";
import {
  GatherCandidatesArguments,
  OnInitArguments,
} from "https://deno.land/x/ddc_vim@v0.14.0/base/source.ts#^";

type Params = {
  executable: string;
};

interface Ctag {
  name: string;
  kind?: string;
  scope?: string;
  scopeKind?: string;
}

export class Source extends BaseSource<Params> {
  private available = false;
  private defaultExecutable = "ctags";

  async onInit(
    { denops, sourceParams }: OnInitArguments<Params>,
  ): Promise<void> {
    // old ddc.vim has no sourceParams here
    const executable = sourceParams
      ? sourceParams.executable
      : this.defaultExecutable;
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
        "executable seem not to be the latest Universal Ctags.",
      );
    }
  }

  async gatherCandidates({
    denops,
    sourceParams,
  }: GatherCandidatesArguments<Params>): Promise<Candidate[]> {
    if (!this.available) {
      return [];
    }
    const file = await fn.expand(denops, "%:p") as string;
    if ((await fn.filereadable(denops, file)) === 0) {
      return [];
    }
    const tags = await this.runCmd([
      sourceParams.executable as string,
      "--output-format=json",
      "--fields={name}{kind}{scope}{scopeKind}",
      "-u",
      file,
    ]);
    return tags.reduce<Candidate[]>((a, b) => {
      if (/^\{.*\}$/.test(b)) {
        let c: Ctag | undefined;
        try {
          c = JSON.parse(b);
        } catch {
          //
        }
        if (c) {
          const candidate: Candidate = {
            word: c.name,
            kind: c.kind,
          };
          if (c.scope && c.scopeKind) {
            candidate.menu = `${c.scope} [${c.scopeKind}]`;
          }
          a.push(candidate);
        }
      }
      return a;
    }, []);
  }

  params(): Params {
    return {
      executable: this.defaultExecutable,
    };
  }

  private async runCmd(cmd: string[]): Promise<string[]> {
    const p = Deno.run({ cmd, stdout: "piped" });
    await p.status();
    return new TextDecoder().decode(await p.output()).split(/\n/);
  }

  private async print_error(denops: Denops, message: string): Promise<void> {
    await denops.call("ddc#util#print_error", message, "ddc-ctags");
  }
}
