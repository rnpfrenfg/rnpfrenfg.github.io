"use client";
import { useState } from "react";
import { Bold, Italic, AlignLeft, AlignCenter, AlignRight } from "lucide-react";
export function PropertiesPanel({ selectedTrack }) {
    const [fontSize, setFontSize] = useState(72);
    const [letterSpacing, setLetterSpacing] = useState(0);
    const [font, setFont] = useState("pretendard");
    const [isBold, setIsBold] = useState(false);
    const [isItalic, setIsItalic] = useState(false);
    const [textAlign, setTextAlign] = useState("left");
    return (<div className="w-80 bg-gray-800 border-l border-gray-700 p-4 flex-shrink-0 overflow-y-auto" data-oid="kauewnb">
      <div className="space-y-6" data-oid="ezdc.u.">
        {/* Font Size */}
        <div data-oid="xlvl6bw">
          <label className="block text-sm text-gray-300 mb-2" data-oid="0uv_q8g">Font Size</label>
          <input type="number" value={fontSize} onChange={(e) => setFontSize(Number(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none transition-colors" data-oid="nv4z2ff"/>

        </div>

        {/* Letter Spacing */}
        <div data-oid="5htu_fx">
          <label className="block text-sm text-gray-300 mb-2" data-oid="s4dtk8d">
            Letter Spacing
          </label>
          <input type="number" value={letterSpacing} onChange={(e) => setLetterSpacing(Number(e.target.value))} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none transition-colors" data-oid="nsswez-"/>

        </div>

        {/* Font */}
        <div data-oid="jhnyz1w">
          <label className="block text-sm text-gray-300 mb-2" data-oid="41b2omq">Font</label>
          <select value={font} onChange={(e) => setFont(e.target.value)} className="w-full bg-gray-700 border border-gray-600 rounded px-3 py-2 text-white focus:border-blue-500 focus:outline-none transition-colors" data-oid="0xezik4">

            <option value="pretendard" data-oid="mq0tygt">pretendard</option>
            <option value="arial" data-oid="rh4ji3.">Arial</option>
            <option value="helvetica" data-oid="utqkv3r">Helvetica</option>
            <option value="times" data-oid="onno9qs">Times New Roman</option>
            <option value="roboto" data-oid="2_17jbz">Roboto</option>
            <option value="inter" data-oid="wh5ptup">Inter</option>
          </select>
        </div>

        {/* Text Formatting */}
        <div data-oid="vcoyfc.">
          <label className="block text-sm text-gray-300 mb-2" data-oid="uk.nc6-">Formatting</label>
          <div className="flex space-x-2" data-oid="nri65a9">
            <button onClick={() => setIsBold(!isBold)} className={`px-3 py-2 rounded transition-colors ${isBold ?
            "bg-blue-600 text-white" :
            "bg-gray-700 text-gray-300 hover:bg-gray-600"}`} data-oid="zencjkf">

              <Bold size={16} data-oid="u6mqcwc"/>
            </button>
            <button onClick={() => setIsItalic(!isItalic)} className={`px-3 py-2 rounded transition-colors ${isItalic ?
            "bg-blue-600 text-white" :
            "bg-gray-700 text-gray-300 hover:bg-gray-600"}`} data-oid=":yvs0k8">

              <Italic size={16} data-oid="cbnlwpy"/>
            </button>
          </div>
        </div>

        {/* Text Alignment */}
        <div data-oid="0ribd:i">
          <label className="block text-sm text-gray-300 mb-2" data-oid=".omkra1">
            Text Alignment
          </label>
          <div className="flex space-x-2" data-oid="ijvg-wg">
            <button onClick={() => setTextAlign("left")} className={`px-3 py-2 rounded transition-colors ${textAlign === "left" ?
            "bg-blue-600 text-white" :
            "bg-gray-700 text-gray-300 hover:bg-gray-600"}`} data-oid="ja:q4x3">

              <AlignLeft size={16} data-oid="fi32j9p"/>
            </button>
            <button onClick={() => setTextAlign("center")} className={`px-3 py-2 rounded transition-colors ${textAlign === "center" ?
            "bg-blue-600 text-white" :
            "bg-gray-700 text-gray-300 hover:bg-gray-600"}`} data-oid="k054qal">

              <AlignCenter size={16} data-oid="qiulnsu"/>
            </button>
            <button onClick={() => setTextAlign("right")} className={`px-3 py-2 rounded transition-colors ${textAlign === "right" ?
            "bg-blue-600 text-white" :
            "bg-gray-700 text-gray-300 hover:bg-gray-600"}`} data-oid="i:6vm5p">

              <AlignRight size={16} data-oid="u6wfvol"/>
            </button>
          </div>
        </div>

        {/* Disable Background */}
        <div data-oid="0:m61r5">
          <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded transition-colors" data-oid="1z6n44:">
            Disable Background
          </button>
        </div>

        {/* Additional Controls */}
        <div className="space-y-4 pt-4 border-t border-gray-700" data-oid="c.ajz0r">
          <div className="flex items-center justify-between" data-oid="10v2gbs">
            <span className="text-sm text-gray-300 font-medium" data-oid="fduxct.">POSITION</span>
            <div className="flex space-x-1" data-oid=":wse96k">
              <div className="w-2 h-2 bg-blue-500 rounded-full" data-oid="3jnomnl"></div>
              <div className="w-2 h-2 bg-gray-600 rounded-full" data-oid="jbhzg-c"></div>
            </div>
          </div>

          <div className="flex items-center justify-between" data-oid="04zm5.a">
            <span className="text-sm text-gray-300 font-medium" data-oid="tb.9ocg">OPACITY</span>
            <div className="flex space-x-1" data-oid="x-nlqua">
              <div className="w-2 h-2 bg-blue-500 rounded-full" data-oid=":68t7xz"></div>
              <div className="w-2 h-2 bg-gray-600 rounded-full" data-oid="oq1_eyp"></div>
            </div>
          </div>

          <div className="flex items-center justify-between" data-oid="90bfhbe">
            <span className="text-sm text-gray-300 font-medium" data-oid="89sfbd_">SCALE</span>
            <div className="flex space-x-1" data-oid=":4edxy1">
              <div className="w-2 h-2 bg-blue-500 rounded-full" data-oid="dybi.0p"></div>
              <div className="w-2 h-2 bg-gray-600 rounded-full" data-oid="yjrp0pn"></div>
            </div>
          </div>
        </div>
      </div>
    </div>);
}
