/**
 * 直流充电相关 CAN ID 识别目录（必须带厂家标注）
 * 自动生成：refs/_extract_battery_matrix.py + gen_dc_id_catalog.py
 * 国标 = GB/T 27930；车内 = 江山/齐星/奇瑞轻卡/天鑫Q22/5021/6460 等
 */

var GBT_PF_CODE = {
  "0x26": "CHM",
  "0x27": "BHM",
  "0x01": "CRM",
  "0x02": "BRM",
  "0x06": "BCP",
  "0x07": "CTS",
  "0x08": "CML",
  "0x09": "BRO",
  "0x0A": "CRO",
  "0x10": "BCL",
  "0x11": "BCS",
  "0x12": "CCS",
  "0x13": "BSM",
  "0x19": "BST",
  "0x1A": "CST",
  "0x1C": "BSD",
  "0x1D": "CSD",
  "0x1E": "BEM",
  "0x1F": "CEM",
  "0xEB": "TP.DT",
  "0xEC": "TP.CM"
};

var GBT_CODE_META = {
  "CHM": {
    "name": "CHM_充电机握手",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "握手",
    "direction": "桩→车",
    "kind": "gbt27930",
    "idHex": "0x1826F456"
  },
  "BHM": {
    "name": "BHM_车辆握手",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "握手",
    "direction": "车→桩",
    "kind": "gbt27930",
    "idHex": "0x182756F4"
  },
  "CRM": {
    "name": "CRM_充电机辨识",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "辨识",
    "direction": "桩→车",
    "kind": "gbt27930",
    "idHex": "0x1801F456"
  },
  "BRM": {
    "name": "BRM_车辆辨识",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "辨识",
    "direction": "车→桩·多帧TP",
    "kind": "gbt27930",
    "idHex": "0x1CEC56F4"
  },
  "BCP": {
    "name": "BCP_动力蓄电池充电参数",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "参数",
    "direction": "车→桩·多帧TP·PGN0x0600",
    "kind": "gbt27930",
    "idHex": "0x1CEC56F4"
  },
  "CTS": {
    "name": "CTS_充电机时间同步",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "参数",
    "direction": "桩→车",
    "kind": "gbt27930",
    "idHex": "0x1807F456"
  },
  "CML": {
    "name": "CML_充电机最大输出能力",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "参数",
    "direction": "桩→车",
    "kind": "gbt27930",
    "idHex": "0x1808F456"
  },
  "BRO": {
    "name": "BRO_车辆就绪",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "就绪",
    "direction": "车→桩",
    "kind": "gbt27930",
    "idHex": "0x100956F4"
  },
  "CRO": {
    "name": "CRO_充电机就绪",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "就绪",
    "direction": "桩→车",
    "kind": "gbt27930",
    "idHex": "0x100AF456"
  },
  "BCL": {
    "name": "BCL_电池充电需求",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "充电",
    "direction": "车→桩",
    "kind": "gbt27930",
    "idHex": "0x181056F4"
  },
  "BCS": {
    "name": "BCS_电池充电总状态",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "充电",
    "direction": "车→桩·多帧TP·PGN0x1100",
    "kind": "gbt27930",
    "idHex": "0x1CEC56F4"
  },
  "CCS": {
    "name": "CCS_充电机充电状态",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "充电",
    "direction": "桩→车",
    "kind": "gbt27930",
    "idHex": "0x1812F456"
  },
  "BSM": {
    "name": "BSM_动力蓄电池状态信息",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "充电",
    "direction": "车→桩",
    "kind": "gbt27930",
    "idHex": "0x181356F4"
  },
  "BST": {
    "name": "BST_车辆中止充电",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "中止",
    "direction": "车→桩",
    "kind": "gbt27930",
    "idHex": "0x101956F4"
  },
  "CST": {
    "name": "CST_充电机中止充电",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "中止",
    "direction": "桩→车",
    "kind": "gbt27930",
    "idHex": "0x101AF456"
  },
  "BSD": {
    "name": "BSD_车辆统计数据",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "统计",
    "direction": "车→桩",
    "kind": "gbt27930",
    "idHex": "0x181C56F4"
  },
  "CSD": {
    "name": "CSD_充电机统计数据",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "统计",
    "direction": "桩→车",
    "kind": "gbt27930",
    "idHex": "0x181DF456"
  },
  "BEM": {
    "name": "BEM_车辆错误",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "错误",
    "direction": "车→桩",
    "kind": "gbt27930",
    "idHex": "0x081E56F4"
  },
  "CEM": {
    "name": "CEM_充电机错误",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "错误",
    "direction": "桩→车",
    "kind": "gbt27930",
    "idHex": "0x081FF456"
  },
  "TP.CM": {
    "name": "TP.CM_连接管理",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "传输",
    "direction": "J1939 TP·按DA/SA变化",
    "kind": "gbt27930",
    "idHex": "0x1CEC0000"
  },
  "TP.DT": {
    "name": "TP.DT_数据传输",
    "manufacturer": "国标GB/T27930",
    "bus": "充电CAN(27930)",
    "stage": "传输",
    "direction": "J1939 TP·按DA/SA变化",
    "kind": "gbt27930",
    "idHex": "0x1CEB0000"
  }
};

/** 精确 ID -> 条目数组（同一 ID 可对应多家，禁止省略厂家） */
var BY_ID = {
  "405206102": [
    {
      "idHex": "0x1826F456",
      "code": "CHM",
      "name": "CHM_充电机握手",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "握手",
      "direction": "桩→车",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 3
    }
  ],
  "405231348": [
    {
      "idHex": "0x182756F4",
      "code": "BHM",
      "name": "BHM_车辆握手",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "握手",
      "direction": "车→桩",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 2
    }
  ],
  "402781270": [
    {
      "idHex": "0x1801F456",
      "code": "CRM",
      "name": "CRM_充电机辨识",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "辨识",
      "direction": "桩→车",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 8
    }
  ],
  "403174486": [
    {
      "idHex": "0x1807F456",
      "code": "CTS",
      "name": "CTS_充电机时间同步",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "参数",
      "direction": "桩→车",
      "kind": "gbt27930",
      "cycleMs": 500,
      "dlc": 7
    }
  ],
  "403240022": [
    {
      "idHex": "0x1808F456",
      "code": "CML",
      "name": "CML_充电机最大输出能力",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "参数",
      "direction": "桩→车",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 8
    }
  ],
  "269047540": [
    {
      "idHex": "0x100956F4",
      "code": "BRO",
      "name": "BRO_车辆就绪",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "就绪",
      "direction": "车→桩",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 1
    }
  ],
  "269153366": [
    {
      "idHex": "0x100AF456",
      "code": "CRO",
      "name": "CRO_充电机就绪",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "就绪",
      "direction": "桩→车",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 1
    }
  ],
  "403724020": [
    {
      "idHex": "0x181056F4",
      "code": "BCL",
      "name": "BCL_电池充电需求",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "充电",
      "direction": "车→桩",
      "kind": "gbt27930",
      "cycleMs": 50,
      "dlc": 5
    }
  ],
  "403895382": [
    {
      "idHex": "0x1812F456",
      "code": "CCS",
      "name": "CCS_充电机充电状态",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "充电",
      "direction": "桩→车",
      "kind": "gbt27930",
      "cycleMs": 50,
      "dlc": 7
    }
  ],
  "403920628": [
    {
      "idHex": "0x181356F4",
      "code": "BSM",
      "name": "BSM_动力蓄电池状态信息",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "充电",
      "direction": "车→桩",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 7
    }
  ],
  "270096116": [
    {
      "idHex": "0x101956F4",
      "code": "BST",
      "name": "BST_车辆中止充电",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "中止",
      "direction": "车→桩",
      "kind": "gbt27930",
      "cycleMs": 10,
      "dlc": 4
    }
  ],
  "270201942": [
    {
      "idHex": "0x101AF456",
      "code": "CST",
      "name": "CST_充电机中止充电",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "中止",
      "direction": "桩→车",
      "kind": "gbt27930",
      "cycleMs": 10,
      "dlc": 4
    }
  ],
  "404510452": [
    {
      "idHex": "0x181C56F4",
      "code": "BSD",
      "name": "BSD_车辆统计数据",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "统计",
      "direction": "车→桩",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 7
    }
  ],
  "404616278": [
    {
      "idHex": "0x181DF456",
      "code": "CSD",
      "name": "CSD_充电机统计数据",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "统计",
      "direction": "桩→车",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 8
    }
  ],
  "136206068": [
    {
      "idHex": "0x081E56F4",
      "code": "BEM",
      "name": "BEM_车辆错误",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "错误",
      "direction": "车→桩",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 4
    }
  ],
  "136311894": [
    {
      "idHex": "0x081FF456",
      "code": "CEM",
      "name": "CEM_充电机错误",
      "manufacturer": "国标GB/T27930",
      "bus": "充电CAN(27930)",
      "stage": "错误",
      "direction": "桩→车",
      "kind": "gbt27930",
      "cycleMs": 250,
      "dlc": 4
    }
  ],
  "419365281": [
    {
      "idHex": "0x18FF01A1",
      "code": "VCU1",
      "name": "VCU1_BMS_Ctrl",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "20",
      "dlc": "8"
    },
    {
      "idHex": "0x18FF01A1",
      "code": "VCU",
      "name": "VCU_BMS_Ctrl",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    },
    {
      "idHex": "0x18FF01A1",
      "code": "VCU1",
      "name": "VCU1_BMS_Ctrl",
      "manufacturer": "齐星",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    }
  ],
  "419373489": [
    {
      "idHex": "0x18FF21B1",
      "code": "BMS1",
      "name": "BMS1_StMode",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "20",
      "dlc": "8"
    },
    {
      "idHex": "0x18FF21B1",
      "code": "BMS1",
      "name": "BMS1_stMode",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    },
    {
      "idHex": "0x18FF21B1",
      "code": "BMS01",
      "name": "BMS01_StMode",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "20",
      "dlc": 8
    },
    {
      "idHex": "0x18FF21B1",
      "code": "BMS1",
      "name": "BMS1_StMode",
      "manufacturer": "齐星",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    }
  ],
  "419374003": [
    {
      "idHex": "0x18FF23B3",
      "code": "BMS3",
      "name": "BMS3_StWork",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "100",
      "dlc": "8"
    },
    {
      "idHex": "0x18FF23B3",
      "code": "BMS03",
      "name": "BMS03_StWork",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "100",
      "dlc": 8
    }
  ],
  "419374260": [
    {
      "idHex": "0x18FF24B4",
      "code": "BMS4",
      "name": "BMS4_State",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "100",
      "dlc": "8"
    },
    {
      "idHex": "0x18FF24B4",
      "code": "BMS04",
      "name": "BMS04_State1",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "100",
      "dlc": 8
    }
  ],
  "419375031": [
    {
      "idHex": "0x18FF27B7",
      "code": "BMS9",
      "name": "BMS9_Fault",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "500",
      "dlc": 8
    },
    {
      "idHex": "0x18FF27B7",
      "code": "BMS09",
      "name": "BMS09_Fault",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "500",
      "dlc": 8
    },
    {
      "idHex": "0x18FF27B7",
      "code": "BMS",
      "name": "BMS_Fault",
      "manufacturer": "齐星",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    }
  ],
  "419374801": [
    {
      "idHex": "0x18FF26D1",
      "code": "BMS15",
      "name": "BMS15_TMS",
      "manufacturer": "江山",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "500",
      "dlc": "8"
    }
  ],
  "419370258": [
    {
      "idHex": "0x18FF1512",
      "code": "BMS4",
      "name": "BMS4",
      "manufacturer": "奇瑞轻卡",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    }
  ],
  "419371026": [
    {
      "idHex": "0x18FF1812",
      "code": "BMS9",
      "name": "BMS9",
      "manufacturer": "奇瑞轻卡",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    }
  ],
  "419397730": [
    {
      "idHex": "0x18FF8062",
      "code": "DCDC1",
      "name": "DCDC1",
      "manufacturer": "奇瑞轻卡",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    }
  ],
  "218102823": [
    {
      "idHex": "0x0CFFFC27",
      "code": "VCU2TBOX",
      "name": "VCU2TBOX",
      "manufacturer": "奇瑞轻卡",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    }
  ],
  "1380": [
    {
      "idHex": "0x564",
      "code": "BMS",
      "name": "BMS_38",
      "manufacturer": "天鑫Q22",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    }
  ],
  "1135": [
    {
      "idHex": "0x46F",
      "code": "BMS",
      "name": "BMS_7",
      "manufacturer": "天鑫Q22",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    },
    {
      "idHex": "0x46F",
      "code": "BMS",
      "name": "BMS_7",
      "manufacturer": "奇瑞5021",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "10",
      "dlc": 8
    },
    {
      "idHex": "0x46F",
      "code": "BMS",
      "name": "BMS_7",
      "manufacturer": "奇瑞6460",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "10",
      "dlc": 8
    }
  ],
  "1131": [
    {
      "idHex": "0x46B",
      "code": "BMS",
      "name": "BMS_3_0x46B",
      "manufacturer": "天鑫Q22",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    }
  ],
  "1137": [
    {
      "idHex": "0x471",
      "code": "OBC",
      "name": "OBC",
      "manufacturer": "天鑫Q22",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": null,
      "dlc": 8
    },
    {
      "idHex": "0x471",
      "code": "CM",
      "name": "CM_1",
      "manufacturer": "奇瑞5021",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "500",
      "dlc": 8
    },
    {
      "idHex": "0x471",
      "code": "CM",
      "name": "CM_1",
      "manufacturer": "奇瑞6460",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "500",
      "dlc": 8
    }
  ],
  "1370": [
    {
      "idHex": "0x55A",
      "code": "BMS",
      "name": "BMS_39",
      "manufacturer": "奇瑞5021",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "1000",
      "dlc": 8
    },
    {
      "idHex": "0x55A",
      "code": "BMS",
      "name": "BMS_39",
      "manufacturer": "奇瑞6460",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "1000",
      "dlc": 8
    }
  ],
  "1132": [
    {
      "idHex": "0x46C",
      "code": "BMS",
      "name": "BMS_4",
      "manufacturer": "奇瑞5021",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "100",
      "dlc": 8
    },
    {
      "idHex": "0x46C",
      "code": "BMS",
      "name": "BMS_4",
      "manufacturer": "奇瑞6460",
      "bus": "车内CAN",
      "stage": "车内直流相关",
      "direction": "",
      "kind": "vehicle_dc",
      "cycleMs": "100",
      "dlc": 8
    }
  ]
};

var VEHICLE_DC_LIST = [
  {
    "id": 419365281,
    "idHex": "0x18FF01A1",
    "code": "VCU1",
    "name": "VCU1_BMS_Ctrl",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": "8",
    "cycleMs": "20",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "VCU1_BMSStModeReq",
      "VCU1_BMS_ThermalWorkSt",
      "VCU1_BMS_ThermalPowerAllow",
      "VCU1_BMS_MaxDCChargeVoltageLim",
      "VCU1_BMS_DCChargeCurr",
      "VCU1_SysUsefulPower",
      "VCU1_RollingCounter",
      "VCU1_CheckSum",
      "VCU_MCUMOT_StModeReq",
      "Vehicle_SOC",
      "VCU_3n1_HvRelayCtr",
      "VCU_PTC_HvRelayCtr"
    ]
  },
  {
    "id": 419373489,
    "idHex": "0x18FF21B1",
    "code": "BMS1",
    "name": "BMS1_StMode",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": "8",
    "cycleMs": "20",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS1_stMode",
      "BMS1_FaultLevel",
      "BMS1_SysFaultCtlSts",
      "BMS1_NegRlySts",
      "BMS1_BattOnboardSts",
      "BMS1_stCC2",
      "BMS1_ThermalReq",
      "BMS1_HVIL_Sts",
      "BMS1_InsulationIntrErr",
      "BMS1_InsulationHVLoadErr",
      "BMS1_DCChrgPosRlySts_A",
      "BMS1_DCChrgNegRlySts_A"
    ]
  },
  {
    "id": 419374003,
    "idHex": "0x18FF23B3",
    "code": "BMS3",
    "name": "BMS3_StWork",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": "8",
    "cycleMs": "100",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS3_DCChrgCurr_Req",
      "BMS3_DCChrgVolt_Req",
      "BMS3_TempTarget",
      "BMS3_SOC",
      "BMS3_SOH",
      "BMS3_ChrgTim_Remain",
      "BMS3_RemaingCapacity"
    ]
  },
  {
    "id": 419374260,
    "idHex": "0x18FF24B4",
    "code": "BMS4",
    "name": "BMS4_State",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": "8",
    "cycleMs": "100",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS4_MaxSOC",
      "BMS4_MinSOC",
      "BMS4_Isolation_Resistance",
      "BMS4_Brach1_Current",
      "BMS4_Brach2_Current"
    ]
  },
  {
    "id": 419375031,
    "idHex": "0x18FF27B7",
    "code": "BMS9",
    "name": "BMS9_Fault",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "500",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS9_Cell_OverVolt",
      "BMS9_Cell_UnderVolt",
      "BMS9_Cell_OverDischrg",
      "BMS9_TotalVolt_Over",
      "BMS9_TotalVolt_Under",
      "BMS9_Cell_Temp_High",
      "BMS9_Cell_Temp_Low",
      "BMS9_Temp_Differ",
      "BMS9_Fiire_Alarm",
      "BMS9_Dischrg_cur_Over",
      "BMS9_Feedback_cur_Over",
      "BMS9_Hall_Fault"
    ]
  },
  {
    "id": 419374801,
    "idHex": "0x18FF26D1",
    "code": "BMS15",
    "name": "BMS15_TMS",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": "8",
    "cycleMs": "500",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS15_TmsModeCtr",
      "BMS15_TMSPwrDwnReq",
      "BMS15_ChrgSts",
      "BMS15_HvRly_Sts",
      "BMS15_BattVolt_Inner",
      "BMS15_TempTarget",
      "BMS15_RollingCounter",
      "BMS15_CheckSum"
    ]
  },
  {
    "id": 419365281,
    "idHex": "0x18FF01A1",
    "code": "VCU",
    "name": "VCU_BMS_Ctrl",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "VCU1_SvsUsefulPower",
      "VCU1_CheckSum",
      "VCU1_RollingCounter",
      "VCU1_BMS_DCChargePower",
      "VCU1_BMS_MaxDCChargeVoltageLim",
      "VCU1_BMS_ThermalPowerAllow",
      "VCU1_BMS_ThermalWorkSt",
      "VCU1_BMSStModeReq"
    ]
  },
  {
    "id": 419373489,
    "idHex": "0x18FF21B1",
    "code": "BMS1",
    "name": "BMS1_stMode",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS1_NegRlySts",
      "BMS1_CheckSum",
      "BMS1_RollingCounter",
      "BMS1_BattVolt",
      "BMS1_BattCurr",
      "BMS1_PowerReq",
      "BMS1_FuelChargeReq",
      "BMS4_DCChrgNegRlySts_B",
      "BMS4_DCChrgPosRlySts_B",
      "BMS4_DCChrgNegRlySts_A",
      "BMS4_DCChrgPosRlySts_A",
      "BMS1_InsulationHVLoadErr"
    ]
  },
  {
    "id": 419373489,
    "idHex": "0x18FF21B1",
    "code": "BMS01",
    "name": "BMS01_StMode",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "20",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS1_stMode",
      "BMS1_FaultLevel",
      "BMS1_SysFaultCtlReq",
      "BMS1_NegRlySts_K6",
      "BMS1_BattOnboardSts",
      "BMS1_stCC2",
      "BMS1_ThermalReq",
      "BMS1_HVIL_Sts",
      "BMS1_InsulationIntrErr",
      "BMS1_InsulationHVLoadErr",
      "BMS1_DCChrgPosRlySts_A_K3",
      "BMS1_DCChrgNegRlySts_A_Invalid"
    ]
  },
  {
    "id": 419374003,
    "idHex": "0x18FF23B3",
    "code": "BMS03",
    "name": "BMS03_StWork",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "100",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS3_DCChrgCurr_Req",
      "BMS3_DCChrgVolt_Req",
      "BMS3_TempTarget",
      "BMS3_SOC",
      "BMS3_SOH",
      "BMS3_ChrgTim_Remain",
      "BMS3_RemaingCapacity"
    ]
  },
  {
    "id": 419374260,
    "idHex": "0x18FF24B4",
    "code": "BMS04",
    "name": "BMS04_State1",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "100",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS4_MaxSOC",
      "BMS4_MinSOC",
      "BMS4_Isolation_Resistance",
      "BMS4_Brach1_Current_Main",
      "BMS4_Brach2_Current_Heat"
    ]
  },
  {
    "id": 419375031,
    "idHex": "0x18FF27B7",
    "code": "BMS09",
    "name": "BMS09_Fault",
    "manufacturer": "江山",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "500",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS9_Cell_OverVolt",
      "BMS9_Cell_UnderVolt",
      "BMS9_Cell_OverDischrg",
      "BMS9_TotalVolt_Over",
      "BMS9_TotalVolt_Under",
      "BMS9_Cell_Temp_High",
      "BMS9_Cell_Temp_Low",
      "BMS9_Temp_Differ",
      "BMS9_Fiire_Alarm",
      "BMS9_Dischrg_cur_Over",
      "BMS9_Feedback_cur_Over",
      "BMS9_Hall_Fault"
    ]
  },
  {
    "id": 419373489,
    "idHex": "0x18FF21B1",
    "code": "BMS1",
    "name": "BMS1_StMode",
    "manufacturer": "齐星",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS1_CheckSum",
      "BMS1_RollingCounter",
      "BMS1_BattVolt",
      "BMS1_BattCurr",
      "BMS1_FuelPowerReq",
      "BMS1_FuelChargeReq",
      "BMS1_DCChrgNegRlySts_B",
      "BMS1_DCChrgPosRlySts_B",
      "BMS1_DCChrgNegRlySts_A",
      "BMS1_DCChrgPosRlySts_A",
      "BMS1_InsulationHVLoadErr",
      "BMS1_InsulationIntrErr"
    ]
  },
  {
    "id": 419365281,
    "idHex": "0x18FF01A1",
    "code": "VCU1",
    "name": "VCU1_BMS_Ctrl",
    "manufacturer": "齐星",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "VCU1_CheckSum",
      "VCU1_RollingCounter",
      "VCU1_SysUsefulPower",
      "VCU1_BMS_DCChargePower",
      "VCU1_BMS_MaxDCChargeVoltageLim",
      "VCU1_BMS_ThermalPowerAllow",
      "VCU1_BMS_ThermalWorkSt",
      "VCU1_BMSStModeReq"
    ]
  },
  {
    "id": 419375031,
    "idHex": "0x18FF27B7",
    "code": "BMS",
    "name": "BMS_Fault",
    "manufacturer": "齐星",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS9_Bat_Overchrg",
      "BMS9_TotalVolt_Link_Err",
      "BMS9_HVIL_Sig_Err",
      "BMS9_Chg_CAN_Fault",
      "BMS9_CC2_Err",
      "BMS9_AccCell_Err",
      "BMS9_Bat_NTC_Link_Err",
      "BMS9_Cell_Link_Off",
      "BMS9_SOC_Over",
      "BMS9_BMS_HW_Fault",
      "BMS9_All_CellVolDiffer",
      "BMS9_Chrg_Ntc_T_Over"
    ]
  },
  {
    "id": 419370258,
    "idHex": "0x18FF1512",
    "code": "BMS4",
    "name": "BMS4",
    "manufacturer": "奇瑞轻卡",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS4_PreChargPosRlyState",
      "BMS4_PreChargPosRlyCtl",
      "BMS4_PosRlyState",
      "BMS4_PosRlyCtl",
      "BMS4_NegRlyState",
      "BMS4_NegRlyCtl",
      "BMS4_ChrOFFCC2",
      "BMS4_CharState",
      "BMS4_CharPosRlyCtl",
      "BMS4_ChrPosRlyState",
      "BMS4_HeatingPosRlyState",
      "BMS4_HeatingPosRlyCtl"
    ]
  },
  {
    "id": 419371026,
    "idHex": "0x18FF1812",
    "code": "BMS9",
    "name": "BMS9",
    "manufacturer": "奇瑞轻卡",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS9_VCU_WarningState",
      "BMS9_VCU_State",
      "BMS9_VCU_PosInsulationResistance",
      "BMS9_VCU_NegInsulationResistance",
      "BMS9_VCU_RqHVPowerOff",
      "BMS9_VCU_FaultCode"
    ]
  },
  {
    "id": 419397730,
    "idHex": "0x18FF8062",
    "code": "DCDC1",
    "name": "DCDC1",
    "manufacturer": "奇瑞轻卡",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "DCDC1_InputVolt",
      "DCDC1_InputCurrent",
      "DCDC1_OutputCurrent",
      "DCDC1_ControllerTemp",
      "DCDC1_OutputVoltAuxLowVolt",
      "DCDC1_DCDCLife",
      "DCDC1_DTCCode",
      "DCDC1_DCDCState",
      "DCDC1_PreChargStaFeedback"
    ]
  },
  {
    "id": 218102823,
    "idHex": "0x0CFFFC27",
    "code": "VCU2TBOX",
    "name": "VCU2TBOX",
    "manufacturer": "奇瑞轻卡",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "VCU_SupplementChargeAllow",
      "VCU_DCDCState"
    ]
  },
  {
    "id": 1380,
    "idHex": "0x564",
    "code": "BMS",
    "name": "BMS_38",
    "manufacturer": "天鑫Q22",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS38_IsoRVal"
    ]
  },
  {
    "id": 1135,
    "idHex": "0x46F",
    "code": "BMS",
    "name": "BMS_7",
    "manufacturer": "天鑫Q22",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS7_MainPositive_Fault",
      "BMS7_HSOC_Fault",
      "BMS7_MainNegative_Fault",
      "BMS7_HeatingTimeout",
      "BMS7_Storage_HV_Fault",
      "BMS7_SOC_Jump_Fault",
      "BMS7_current_sampling_Err",
      "BMS7_OverChgCurrentSts",
      "BMS7_Volt_acquisition_line_break",
      "BMS7_VCU_CAN_FAILED",
      "BMS7_UnderVoltageSts",
      "BMS7_UnderSOCSts"
    ]
  },
  {
    "id": 1131,
    "idHex": "0x46B",
    "code": "BMS",
    "name": "BMS_3_0x46B",
    "manufacturer": "天鑫Q22",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS2_BatteryVoltage",
      "BMS2_BatteryCurrent",
      "BMS2_SOH",
      "BMS2_AverageBattTemp",
      "BMS2_DCBusVoltage"
    ]
  },
  {
    "id": 1137,
    "idHex": "0x471",
    "code": "OBC",
    "name": "OBC",
    "manufacturer": "天鑫Q22",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": null,
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "OBC_UnderVoltage",
      "OBC_ShortCircuit",
      "OBC_OverVoltage",
      "OBC_OverTemperature",
      "OBC_NoBattery",
      "OBC_LowVoltOTFault",
      "OBC_InputUnderVoltage",
      "OBC_InputOverVoltage",
      "OBC_FanFault",
      "OBC_CurrentOutputFault",
      "OBC_ChargeVoltage",
      "OBC_ChargeCurrent"
    ]
  },
  {
    "id": 1370,
    "idHex": "0x55A",
    "code": "BMS",
    "name": "BMS_39",
    "manufacturer": "奇瑞5021",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "1000",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "Hld_Bms_CellUnderVoltageSts_B",
      "Hld_Bms_DISCHGDiffTempSts",
      "Hld_Bms_CHGDiffTempSts",
      "VEHILCLE_DISCHGHVINTERLOCK_FAULT",
      "VEHILCLE_CHGHVINTERLOCK_FAULT",
      "BATTCELL_VOLSAMPLINGLINE_FAULT",
      "BATTCELL_OVERVOLTAGE_FAULT",
      "BATT_DISCHGCELLCONSISTENCY_ALARM",
      "BATT_CHGCELLCONSISTENCY_ALARM",
      "BAAT_PACKVOLSAMPINGLOOP_FAULT",
      "PILECUR_SAMPLING_FAULT",
      "PILE_UNDERVOLTAGE_FAULT"
    ]
  },
  {
    "id": 1135,
    "idHex": "0x46F",
    "code": "BMS",
    "name": "BMS_7",
    "manufacturer": "奇瑞5021",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "10",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "TemperatureGatheringLineBreak",
      "BMS_SINGLEHEATINGTIMEOUT_FAULT",
      "POWERSUPPLY_BMS_UNDERVLT_FAULT",
      "TemperatureRisingToofast",
      "PowerOn_SelfChecking_HW_Flt",
      "MainPositiveRelay_adhesion",
      "MainNegativeRelay_adhesion",
      "Hld_Bms_UnderVoltageSts",
      "Hld_Bms_UnderSOCSts",
      "Hld_Bms_SOCjumpSts",
      "Hld_Bms_OverVoltageSts",
      "Hld_Bms_OverSOCSts"
    ]
  },
  {
    "id": 1132,
    "idHex": "0x46C",
    "code": "BMS",
    "name": "BMS_4",
    "manufacturer": "奇瑞5021",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "100",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS_IsoRVal",
      "Hld_Bms_LowestCellVoltage",
      "Hld_Bms_LowestBattTemp",
      "Hld_Bms_HighestCellVoltage",
      "Hld_Bms_HighestBattTemp"
    ]
  },
  {
    "id": 1137,
    "idHex": "0x471",
    "code": "CM",
    "name": "CM_1",
    "manufacturer": "奇瑞5021",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "500",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "Hld_OBC_OverTemperature",
      "Hld_OBC_NoBattery_BatteryReverse",
      "Hld_OBC_LowVoltOTFault",
      "Hld_OBC_InputUnderVoltage",
      "Hld_OBC_InputOverVoltage",
      "Hld_OBC_HighVoltOutput_ShortCir",
      "Hld_OBC_HighVoltOutput_OverVolt",
      "Hld_OBC_HighVoltOutput_UnderVolt",
      "Hld_OBC_HighCurrentOutputFault",
      "Hld_OBC_FanFault",
      "Hld_OBC_ChargeVoltage",
      "Hld_OBC_ChargeCurrent"
    ]
  },
  {
    "id": 1370,
    "idHex": "0x55A",
    "code": "BMS",
    "name": "BMS_39",
    "manufacturer": "奇瑞6460",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "1000",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "Hld_Bms_CellUnderVoltageSts_B",
      "Hld_Bms_DISCHGDiffTempSts",
      "Hld_Bms_CHGDiffTempSts",
      "VEHILCLE_DISCHGHVINTERLOCK_FAULT",
      "VEHILCLE_CHGHVINTERLOCK_FAULT",
      "BATTCELL_VOLSAMPLINGLINE_FAULT",
      "BATTCELL_OVERVOLTAGE_FAULT",
      "BATT_DISCHGCELLCONSISTENCY_ALARM",
      "BATT_CHGCELLCONSISTENCY_ALARM",
      "BAAT_PACKVOLSAMPINGLOOP_FAULT",
      "PILECUR_SAMPLING_FAULT",
      "PILE_UNDERVOLTAGE_FAULT"
    ]
  },
  {
    "id": 1135,
    "idHex": "0x46F",
    "code": "BMS",
    "name": "BMS_7",
    "manufacturer": "奇瑞6460",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "10",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "TemperatureGatheringLineBreak",
      "BMS_SINGLEHEATINGTIMEOUT_FAULT",
      "POWERSUPPLY_BMS_UNDERVLT_FAULT",
      "TemperatureRisingToofast",
      "PowerOn_SelfChecking_HW_Flt",
      "MainPositiveRelay_adhesion",
      "MainNegativeRelay_adhesion",
      "Hld_Bms_UnderVoltageSts",
      "Hld_Bms_UnderSOCSts",
      "Hld_Bms_SOCjumpSts",
      "Hld_Bms_OverVoltageSts",
      "Hld_Bms_OverSOCSts"
    ]
  },
  {
    "id": 1132,
    "idHex": "0x46C",
    "code": "BMS",
    "name": "BMS_4",
    "manufacturer": "奇瑞6460",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "100",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "BMS_IsoRVal",
      "Hld_Bms_LowestCellVoltage",
      "Hld_Bms_LowestBattTemp",
      "Hld_Bms_HighestCellVoltage",
      "Hld_Bms_HighestBattTemp"
    ]
  },
  {
    "id": 1137,
    "idHex": "0x471",
    "code": "CM",
    "name": "CM_1",
    "manufacturer": "奇瑞6460",
    "bus": "车内CAN",
    "dlc": 8,
    "cycleMs": "500",
    "stage": "车内直流相关",
    "direction": "",
    "kind": "vehicle_dc",
    "match": "id",
    "signalsHint": [
      "Hld_OBC_OverTemperature",
      "Hld_OBC_NoBattery_BatteryReverse",
      "Hld_OBC_LowVoltOTFault",
      "Hld_OBC_InputUnderVoltage",
      "Hld_OBC_InputOverVoltage",
      "Hld_OBC_HighVoltOutput_ShortCir",
      "Hld_OBC_HighVoltOutput_OverVolt",
      "Hld_OBC_HighVoltOutput_UnderVolt",
      "Hld_OBC_HighCurrentOutputFault",
      "Hld_OBC_FanFault",
      "Hld_OBC_ChargeVoltage",
      "Hld_OBC_ChargeCurrent"
    ]
  }
];


function normalizeId(id) {
  if (id == null) return null;
  if (typeof id === 'number') return id >>> 0;
  var s = String(id).replace(/^0x/i, '');
  var n = parseInt(s, 16);
  return isFinite(n) ? (n >>> 0) : null;
}

function labelOf(entry) {
  if (!entry) return '未标注厂家';
  var mfr = entry.manufacturer || '未标注厂家';
  var name = entry.name || entry.code || '';
  var bus = entry.bus ? (' · ' + entry.bus) : '';
  return '[' + mfr + '] ' + name + bus;
}

/**
 * 识别一帧：返回 { code, manufacturers[], labels[], entries[], isGbt27930 }
 * 厂家字段必填；未知则 manufacturers=['未识别厂家']
 */
function identifyFrame(id, pf, codeHint) {
  var nid = normalizeId(id);
  var entries = [];
  var manufacturers = [];
  var labels = [];
  var code = codeHint || '';
  var isGbt = false;

  if (nid != null && BY_ID[String(nid)]) {
    BY_ID[String(nid)].forEach(function (e) {
      entries.push(e);
      if (manufacturers.indexOf(e.manufacturer) < 0) manufacturers.push(e.manufacturer);
      labels.push(labelOf(e));
      if (e.kind === 'gbt27930') isGbt = true;
      if (!code) code = e.code;
    });
  }

  // 国标 PF 识别（充电 CAN）
  if (pf != null) {
    var pfKey = '0x' + (('0' + (pf & 0xff).toString(16)).slice(-2).toUpperCase());
    var gcode = GBT_PF_CODE[pfKey];
    if (gcode && GBT_CODE_META[gcode]) {
      var meta = GBT_CODE_META[gcode];
      isGbt = true;
      code = gcode;
      var exists = entries.some(function (e) {
        return e.manufacturer === meta.manufacturer && e.code === gcode;
      });
      if (!exists) {
        entries.push(meta);
        labels.push(labelOf(meta));
      }
      if (manufacturers.indexOf(meta.manufacturer) < 0) manufacturers.push(meta.manufacturer);
    }
  }

  if (!manufacturers.length) {
    manufacturers = ['未识别厂家'];
    labels = ['[未识别厂家] 未在直流充电目录中'];
  }

  return {
    code: code,
    manufacturers: manufacturers,
    manufacturerText: manufacturers.join('/'),
    labels: labels,
    labelText: labels.join('；'),
    entries: entries,
    isGbt27930: isGbt
  };
}

function listByManufacturer(mfr) {
  var out = [];
  Object.keys(BY_ID).forEach(function (k) {
    BY_ID[k].forEach(function (e) {
      if (!mfr || e.manufacturer === mfr) out.push(e);
    });
  });
  VEHICLE_DC_LIST.forEach(function (e) {
    if (!mfr || e.manufacturer === mfr) out.push(e);
  });
  return out;
}

function getCatalogSummary() {
  var map = {};
  function add(e) {
    var m = e.manufacturer || '未标注厂家';
    map[m] = (map[m] || 0) + 1;
  }
  Object.keys(BY_ID).forEach(function (k) {
    BY_ID[k].forEach(add);
  });
  Object.keys(GBT_CODE_META).forEach(function (k) {
    add(GBT_CODE_META[k]);
  });
  VEHICLE_DC_LIST.forEach(add);
  return map;
}

module.exports = {
  BY_ID: BY_ID,
  GBT_PF_CODE: GBT_PF_CODE,
  GBT_CODE_META: GBT_CODE_META,
  VEHICLE_DC_LIST: VEHICLE_DC_LIST,
  identifyFrame: identifyFrame,
  labelOf: labelOf,
  listByManufacturer: listByManufacturer,
  getCatalogSummary: getCatalogSummary,
  normalizeId: normalizeId
};
