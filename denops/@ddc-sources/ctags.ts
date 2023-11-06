import { Denops, fn } from "https://deno.land/x/ddc_vim@v4.0.5/deps.ts#^";
import {
  BaseSource,
  Item,
} from "https://deno.land/x/ddc_vim@v4.0.5/types.ts#^";
import {
  GatherArguments,
  OnInitArguments,
} from "https://deno.land/x/ddc_vim@v4.0.5/base/source.ts#^";

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

  async gather({
    denops,
    sourceParams,
  }: GatherArguments<Params>): Promise<Item[]> {
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
    return tags.reduce<Item[]>((a, b) => {
      if (/^\{.*\}$/.test(b)) {
        let c: Ctag | undefined;
        try {
          c = JSON.parse(b);
        } catch {
          //
        }
        if (c) {
          const item: Item = {
            word: c.name,
            kind: c.kind,
          };
          if (c.scope && c.scopeKind) {
            item.menu = `${c.scope} [${c.scopeKind}]`;
          }
          a.push(item);
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
    const proc = new Deno.Command(
      cmd[0],
      {
        args: cmd.slice(1),
        stdout: "piped",
        stderr: "null",
      },
    );

    const { stdout } = await proc.output();
    return new TextDecoder().decode(stdout).split(/\n/);
  }

  private async print_error(denops: Denops, message: string): Promise<void> {
    await denops.call("ddc#util#print_error", message, "ddc-ctags");
  }
}
