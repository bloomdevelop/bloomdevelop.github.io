---
hero: "/images/posts/linux_adventure_kde_neon.png"
title: "Linux Adventure: KDE Neon"
description: "Probably contains mildly graphical glitches at all."
tags: ["Linux"]
pubDate: 6/7/25
---

## Quick introduction

Alright so, I'm back into writing some articles since I don't have anything to do. Before, I was using Ubuntu (obviously was very fine for my ThinkPad P43s), but I realized that there was some issue while I was using this distribution.

## Issues with Ubuntu

There's some issue I have listed during my usage before I moved to something else, there why it's very annoying to me:

### Per monitor settings

Some of the issue I had was changing wallpaper, fractional scaling (or scaling, whatever the hell this is) only works on all monitor, not specific monitor, since I'm on Ubuntu (not different flavors), there's something on the session is called "Ubuntu Desktop" (it's a modification of GNOME Desktop with Extensions), it is obviously running on GNOME, which means there are some limitations which *might* be annoying when I wanted to avoid peoples questioning about the wallpaper (I mean, the fact I am furry, that's why I wanted to have a furry wallpapers in my desktop) I put here.

Another thing about the scaling on the desktop itself, I wanted to have different scaling for each monitor, so I don't have to suffer having almost no spaces while moving a window to another monitor (more like claustrophobia *but on monitor*), when I was trying to fix this issue, there was no solution since only it lets me scale (between 100% to 150%?), all it does it apply to all monitor, which I don't like it.

### Why doesn't it have flatpak support on Ubuntu's App Center?

Well, according to issue [#126](https://github.com/ubuntu/app-center/issues/126) on Ubuntu's App Center repository. They said we don't support `flatpak` but recommending installing `gnome-software` instead. But I didn't quite like when it comes to having two different software applications, quite annoying for me, but it looks fine to other peoples. Eh, whatever.

### Other issues with two different App Stores

Another thing I forgot to note about this, when I'm searching for applications to install for my system, only `gnome-software` has search support on desktop-level, while Ubuntu's App Center doesn't have, which means I have to search **inside the App Center**, sound like additional step to search an application from `snap`.

## KDE Neon: KDE's own distribution based with Ubuntu

I wanted to have KDE Plasma without additional software (e.g. App Center, unnecessary apps, etc...), this is what I've found was KDE Neon, it's a Linux distribution based on Ubuntu, while having this [own APT repository](https://archive.neon.kde.org) (it's a repository, I suggest don't add this on your Ubuntu/Debian system as it might conflict some packages), since this desktop has some feature what I need (e.g. per monitor settings, for example setting different wallpaper on second monitor), including the Software Center (Discover) which has both supports for Flatpak and Snap, quite convenient to me. No other issues on GNOME was present while I used this distribution. But there's slightly small issues (sometimes quite strange) I listed during use:

### Graphical Glitches on [Vesktop](https://github.com/Vencord/Vesktop)

While I was using Roblox Studio via [Vinegar](https://github.com/vinegarhq/vinegar), I realized something went very wrong with the application on the second monitor, it looked very much fucked up, and I have a screenshot why:

![Screenshot I took while having a strange graphical glitch](/images/posts/Screenshot_20250605_153525.png)
<figcaption>

Screenshot I took while having a strange graphical glitch

</figcaption>

Looks like a literal glitched mess to me, I still had no clue why it happened to me. This was until I proceeded to restart my laptop, then open Vesktop again, and now it's fixed. Very strange.

## Closing

Since it's only one graphical glitches so far during my usage, I'd say confidently I'm going to continue using this system for now, unless there problems that prevents from using it.

I'd say it been for a while since I never wrote an article like this, but, this is first time I've done a review on this distribution. I don't think if I feel after writing this. Anyway, I'm unsure what's the next article is going to be, like I wanted to keep posting new articles and not being lazy at all, but for now, I'd keep moving.
