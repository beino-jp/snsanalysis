'use client';
import {useEffect} from 'react';
export default function AuthLinkRouter(){
 useEffect(()=>{
  if(location.pathname==='/auth/finish')return;
  const hash=new URLSearchParams(location.hash.slice(1));
  if(['invite','recovery'].includes(hash.get('type')??'')||hash.has('error_code'))location.replace('/auth/finish'+location.hash);
 },[]);
 return null;
}
