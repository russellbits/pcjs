---
layout: post
title: Turbo Pascal vs. QuickPascal
date: 2018-03-22 10:00:00
permalink: /blog/2018/03/22/
machines:
  - id: ibm5170-msdos320-1
    type: pcx86
    class: machine-left
    state: /disks/pcx86/tools/microsoft/pascal/quickpascal/1.00/state.json
    config: /devices/pcx86/machine/5170/ega/640kb/rev3/machine.xml
    drives: '[{name:"10Mb Hard Disk",type:1,path:"/pcjs-disks/pcx86/drives/10mb/MSDOS320-C400.json"}]'
    autoMount:
      A:
        name: None
      B:
        name: None
    autoStart: true
    autoType: CD TP\rTURBO\r$5$0$altf\r$5$0\r$5$0\r$5$0$altr\r
  - id: ibm5170-msdos320-2
    type: pcx86
    class: machine-right
    state: /disks/pcx86/tools/microsoft/pascal/quickpascal/1.00/state.json
    config: /devices/pcx86/machine/5170/ega/640kb/rev3/machine.xml
    drives: '[{name:"10Mb Hard Disk",type:1,path:"/pcjs-disks/pcx86/drives/10mb/MSDOS320-C400.json"}]'
    autoMount:
      A:
        name: None
      B:
        name: None
    autoStart: true
    autoType: CD QP\rQP\r$10$ctrl$f4$1$altf$down\r\\tp\r\t\r\r$10$altr$down\r
---

Below are side-by-side PCjs machines running
[Borland Turbo Pascal 5.00](/disks/pcx86/tools/borland/pascal/5.00/) and
[Microsoft QuickPascal 1.00](/disks/pcx86/tools/microsoft/pascal/quickpascal/1.00/).  Make your browser window
nice and wide, and then sit back and be mesmerized.

We reveal who the winner is [below the fold](#whos-the-winner). 

{% include machine.html id="ibm5170-msdos320-1" %}

{% include machine.html id="ibm5170-msdos320-2" %}

---

### Who's The Winner?

PCjs, obviously.  This demo shows off several PCjs improvements, including an easier way to layout side-by-side
machines, using new `machine-left` and `machine-right` classes.

There's also been some improvements to the *autoType* feature, making it easier to encode delays (from 1/10 of a second
to any number of whole seconds) and specify special key sequences.

Here's an example of "injecting" Ctrl-F4, followed by a 1/10 second delay, followed by Alt-F:

    autoType: $ctrl$f4$1$altf

For software that needs more than just key injection, sophisticated scripts are possible.  Here's the "startMouse"
script for IBM's [TopView 1.01](/disks/pcx86/apps/ibm/topview/1.01/debugger/):

    wait Keyboard DOS;
    type Keyboard "$date\r$time\r";
    wait Keyboard;
    sleep 1000;
    select FDC listDrives "A:";
    select FDC listDisks "MS Mouse 5.00 (SYSTEM)";
    loadDisk FDC;
    wait FDC;
    type Keyboard "MOUSE\r";
    sleep 7000;
    type Keyboard "B:\rSETUP\r$50.3\r$20n\r$20y\r$20\r$20\r$20.1\r";

The above script automatically "inserts" the [Microsoft Mouse 5.00](/disks/pcx86/tools/microsoft/mouse/5.00/) diskette
into drive A:, loads the mouse driver, and then configures TopView for serial mouse support.

*[@jeffpar](http://twitter.com/jeffpar)*  
*Mar 22, 2018*