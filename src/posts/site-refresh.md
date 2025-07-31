---
hero: "/images/posts/site_refresh.png"
title: "Refreshing the whole website"
description: "Fixing the complexity issues..."
tags: ["Website", "Design", "Web Development"]
pubDate: 7/31/25
---

> Work in Progress, this content isn't finished yet.

It has been days since I firstly published the first article on reviewing a Linux distribution, for what I've seen the current state from its own site, there was a mix between React and Astro, basically making the site looks "too complex" to work with this, I tried redesigning the site without overwriting the components (basically preserving the functionality), it didn't quite work very well, it had become very annoying to be able to fix this issue, even on some components that use React.

## How I can fix this?

It's quite easy to leave the site looks very out of place and call it a "day", mainly due I became way *lazier* than anybody else, for example, the Post and Tag search where made entirely by, oh well you might say *"oh, this component was made by AI"*. Well, it's quite on an unfortunate truth, yes, I did use AI for this, even they're dumb enough to not follow the site's style I'm following (basically monospaced font as a variable font with a monospace theme from IDX/Firebase Studio). This issue has been plaguing the whole site at the time.

Now what? I have only two options, redo the site from zero or keep making content instead. For what I've decided, you know what. I'm redoing the site from zero, but this time the same framework I used with an exception to React, before doing that, I looked for alternatives that lets me customize the components without making a literal mess in the CSS file, I've chosen to use Tailwind and DaisyUI combined, despite it's still easy to install and configure, but it has theming feature via `@plugin`. Now, does it actually fixes the issues for this site. Yes, it does, take a look how it looked like:

![This is a new design for my site](/images/posts/Screenshot_at_2025-07-31_08-52-58.png)
<figcaption>

This is a new design for this site

</figcaption>

You might notice that the window decoration is different, its is because I'm not on a ThinkPad unfortunately, my laptop is currently on a site where they do laptop repairs, I sent it to fix the thermal issue and clean the fan (these dust have filled the whole fan, making the laptop harder to breathe or flow the hot air out)

Also, there's an interesting addition on this design, something called "View Transition", expect it use from Astro's own component to provide this feature, even on some browser that doesn't support it (ironically, it in fact does work on PlayStation 4 running on WebKit 605.1.11, but it is slightly shittier, that's why I put a logic to disable it). One of my favorite addition I implement so far, yet it looked like smooth as butter, scaling out and in from page to pages.

> Important: There's no comment features sadly, but I'm not adding it anymore.

## What's next?

Making the site looks simple is still one of my favorite things I wanted to make into a reality. For now, might start creating dev-log content, from my site, I've recently started to learn how to create a Roblox game, one of these best exception so far, it's going to use a mix of Luau and TypeScript (for both server and client), this might be a fun journey for me. Also before I finish writing this, you can take a look on my codebase found on [GitHub](https://github.com/bloomdevelop/spring-testing-place), and for site, there's a [link I provided as well](https://github.com/bloomdevelop/bloomdevelop.github.io).

Have a nice day.
