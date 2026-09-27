{ pkgs ? import <nixpkgs> { } }:

pkgs.mkShell {
  packages = with pkgs; [
    nodejs_24
    pnpm_11
    git
    cacert
  ];

  shellHook = ''
    [ -d node_modules ] || pnpm install
  '';
}
