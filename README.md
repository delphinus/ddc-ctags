# ddc-ctags

Universal Ctags completion for ddc.vim

This source collects candidates from [Universal Ctags](https://github.com/universal-ctags/ctags).

## Required

### denops.vim

https://github.com/vim-denops/denops.vim

### ddc.vim

https://github.com/Shougo/ddc.vim

### Universal Ctags

https://github.com/universal-ctags/ctags

#### NOTE

You need **Universal Ctags**, neither the original Ctags nor [Exuberant Ctags](http://ctags.sourceforge.net/).

## Configuration

```vim
" Use around source.
call ddc#custom#patch_global('sources', ['ctags'])

" Change source options
call ddc#custom#patch_global('sourceOptions', {
      \ 'ctags': {'mark': 'C'},
      \ })
```
