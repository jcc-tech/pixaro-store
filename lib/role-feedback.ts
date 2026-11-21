export type FeedbackRole = "rich client" | "leviathan";
const actionable = 'button, a[href], summary, [role="button"], input[type=button], input[type=submit], input[type=reset], input[type=image], input[type=checkbox], input[type=radio], select, [role=slider], label[for]';

export function listenForPresses(getRole:()=>FeedbackRole|null,onEffect?:(role:FeedbackRole, control:Element)=>void) {
  let overlay:HTMLDivElement|null=null;
  const running=new Set<Animation>();
  function dismiss(){
    for(const animation of running)animation.cancel();
    running.clear();
    overlay?.remove();
    overlay=null;
  }
  function paint(control:Element,role:FeedbackRole,event:MouseEvent) {
    dismiss();
    const bounds=control.getBoundingClientRect();
    const x=event.detail || event.type==="pointerdown"?event.clientX:bounds.left+bounds.width/2;
    const y=event.detail || event.type==="pointerdown"?event.clientY:bounds.top+bounds.height/2;
    const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
    const deep=role==="leviathan";
    const ink=deep?"#71eee3":"#dbb2ff";
    const layer=document.createElement("div");
    overlay=layer;
    layer.ariaHidden="true";
    layer.style.cssText="position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;padding:0;border:0;background:transparent;overflow:clip;pointer-events:none;z-index:2147483647;color-scheme:normal;";
    if("showPopover" in layer)layer.setAttribute("popover","manual");
    (document.querySelector("dialog[open]")??document.body).appendChild(layer);
    if(layer.hasAttribute("popover"))layer.showPopover();
    function draw(css:string,frames:Keyframe[],duration:number,delay=0){
      const shape=document.createElement("span");
      shape.style.cssText="position:absolute;display:block;box-sizing:border-box;pointer-events:none;left:"+x+"px;top:"+y+"px;"+css;
      layer.appendChild(shape);
      const animation=shape.animate(frames,{duration,delay,fill:"both",easing:"cubic-bezier(.17,.66,.28,1)"});
      running.add(animation);
      animation.onfinish=()=>{running.delete(animation);if(!running.size && overlay===layer)dismiss();};
    }
    if(reduced){
      draw("width:18px;height:18px;border-radius:"+(deep?"50%":"3px")+";border:2px solid "+ink+";background:#292132;transform:translate(-50%,-50%) rotate(45deg)",[{opacity:1},{opacity:1}],230);
      return;
    }
    for(let i=0;i<(deep?3:2);i++){
      const shape=deep?"border-radius:50%;":"border-radius:12%;";
      const turn=deep?0:45;
      draw("width:36px;height:36px;"+shape+"border:2px solid "+ink+";box-shadow:0 0 6px "+ink+"88;",
        [{transform:"translate(-50%,-50%) rotate("+turn+"deg) scale(.18)",opacity:1},{transform:"translate(-50%,-50%) rotate("+turn+"deg) scale("+(deep?2.7:1.75)+")",opacity:0}],deep?680:470,i*85);
    }
    for(let i=0;i<(deep?5:6);i++){
      const angle=2*Math.PI*i/(deep?5:6);
      const dx=Math.round(Math.cos(angle)*42),dy=Math.round(Math.sin(angle)*32);
      draw("width:5px;height:"+(deep?8:5)+"px;border-radius:"+(deep?"50%":"0")+";background:"+ink+";",
        [{opacity:1,transform:"translate(-50%,-50%) rotate(45deg)"},{opacity:0,transform:"translate("+dx+"px,"+dy+"px) rotate(45deg)"}],490,25);
    }
  }
  function onPress(event:MouseEvent){
    const role=getRole();
    if(role!=="rich client" && role!=="leviathan")return;
    const control=event.target instanceof Element?event.target.closest(actionable):null;
    if(!control || control.matches(":disabled,[aria-disabled=true]") || control.closest("[inert]"))return;
    // Start pointer feedback on press, before a dialog opens or a link navigates.
    // Keyboard and assistive-technology activations generate a zero-detail click.
    if(event.type==="pointerdown" && event.button!==0 || event.type==="click" && event.detail!==0)return;
    paint(control,role,event);
    onEffect?.(role,control);
  }
  document.addEventListener("pointerdown",onPress,true);
  document.addEventListener("click",onPress,true);
  return ()=>{document.removeEventListener("pointerdown",onPress,true);document.removeEventListener("click",onPress,true);dismiss();};
}
