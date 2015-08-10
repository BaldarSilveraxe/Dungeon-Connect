var DungeonConnectWalls = (function () {
    'use strict';
    var wallTextures = [];
    
    wallTextures['Simple_Stone'] = [
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/10575757/iV0h0h07y3-oWBt8a79qVQ/thumb.png?1436026061', 
            key: 'DC_000', type: 'wall', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429824/SqRzesx-F38lT3YNQ1eOLw/thumb.jpg?1439207959', 
            key: 'DC_001', type: 'wall', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429825/s_z_046Cz1a9eVl4Kp4vWQ/thumb.jpg?1439207959', 
            key: 'DC_002', type: 'wall', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429829/tPeBJcAqnn6SpCUserBn4A/thumb.jpg?1439207959', 
            key: 'DC_003', type: 'wall', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429826/mWQHVu32UNXdnUo5sQiEQw/thumb.jpg?1439207959', 
            key: 'DC_004', type: 'wall', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429830/leZlkPdkwchybwluwHDqzA/thumb.jpg?1439207959', 
            key: 'DC_005', type: 'wall', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429823/0kNt0xgGPBylgPtLCvJdkQ/thumb.jpg?1439207959', 
            key: 'DC_006', type: 'wall', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429828/Jvrs3WDVofkxBR3AL3L6Aw/thumb.jpg?1439207959', 
            key: 'DC_007', type: 'wall', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429827/dtPN985QMZYV1ysQ_zfjAQ/thumb.jpg?1439207959', 
            key: 'DC_008', type: 'wall', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11191278/deOdrZRTetxrEADRtDR7CQ/thumb.png?1438373328', 
            key: 'DCF_001', type: 'feature', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11191280/wNYw46V82Hk0hXAqfuEphQ/thumb.png?1438373338', 
            key: 'DCF_002', type: 'feature', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11186031/XecFgYPYYRMVvg74BjdP5A/thumb.png?1438356152', 
            key: 'DCF_003', type: 'feature', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11042948/BttIk5jTIW9_d_rsCpjvPA/thumb.png?1437833053', 
            key: 'DCF_004', type: 'feature', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11413589/E98X2gEwssLKQzVTP4Z7rg/thumb.png?1439151342', 
            key: 'DCF_005', type: 'feature', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11402344/42oGrNCEKQ7ZkmgbwtXQPw/thumb.png?1439118968', 
            key: 'DCF_006', type: 'feature', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11403191/qNyVtiTjNEMueuX0WQHymw/thumb.png?1439123451', 
            key: 'DCF_007', type: 'feature', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11403192/V8Jc_9W7UBcMwNrYFTiyUQ/thumb.png?1439123458', 
            key: 'DCF_008', type: 'feature', value: 256, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429842/SJXjtvnRvKCpHsqy7XDpmQ/thumb.jpg?1439207985', 
            key: 'DCB_001', type: 'node', value: 1, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429837/cJcYD4uHA0FA2uB1ts6efg/thumb.jpg?1439207985', 
            key: 'DCB_002', type: 'node', value: 2, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429836/uCDTXzOf3KwJg8zc5PwO7A/thumb.jpg?1439207985', 
            key: 'DCB_003', type: 'node', value: 3, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429839/lcRXO1PS3lxeE-1tsxR_Sw/thumb.jpg?1439207985', 
            key: 'DCB_004', type: 'node', value: 5, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429835/tq2s688GBAu0UEii7KMs-Q/thumb.jpg?1439207985', 
            key: 'DCB_005', type: 'node', value: 7, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429838/IL9dG1XJlX5LBcetJmZf1A/thumb.jpg?1439207985', 
            key: 'DCB_006', type: 'node', value: 9, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429834/ZpoQkVsGYjPMgHxJyukXuQ/thumb.jpg?1439207985', 
            key: 'DCB_007', type: 'node', value: 10, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429841/LsQmM5i0mfevbG-1tM3NNA/thumb.jpg?1439207985', 
            key: 'DCB_008', type: 'node', value: 11, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429840/5o9e4Eb7sjCe_WFnVzlxzg/thumb.jpg?1439207985', 
            key: 'DCB_009', type: 'node', value: 13, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429833/EbtjTC38ag48Fp7QdLDtgA/thumb.jpg?1439207985', 
            key: 'DCB_010', type: 'node', value: 14, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429847/gTSstPdju27QzTzbt_L-xA/thumb.jpg?1439207999', 
            key: 'DCB_011', type: 'node', value: 15, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429846/C1vVUI6zIMvzUaa5YYaQ2w/thumb.jpg?1439207999', 
            key: 'DCB_012', type: 'node', value: 17, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429843/xtMnlGU8_am7xzAjgUVs2w/thumb.jpg?1439207999', 
            key: 'DCB_013', type: 'node', value: 19, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429848/LTscIq3swNMfxB3b6y1o-Q/thumb.jpg?1439207999', 
            key: 'DCB_014', type: 'node', value: 21, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429852/C288-bYv3DLJOVEeUMQEJA/thumb.jpg?1439207999', 
            key: 'DCB_015', type: 'node', value: 23, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429845/6d1pBnkvMdDNOD682_2lFA/thumb.jpg?1439207999', 
            key: 'DCB_016', type: 'node', value: 27, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429850/ZhXcdeaqKZPRF_HXdCanAg/thumb.jpg?1439207999', 
            key: 'DCB_017', type: 'node', value: 31, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429849/uISxQTR7nZ_TSdg9p5gfbg/thumb.jpg?1439207999', 
            key: 'DCB_018', type: 'node', value: 34, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429851/BCnOAgiT3xq0761nxpIU4w/thumb.jpg?1439207999', 
            key: 'DCB_019', type: 'node', value: 35, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429844/DuButfLACJbWULzllLUiiA/thumb.jpg?1439207999', 
            key: 'DCB_020', type: 'node', value: 37, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429858/jVEA_Y2rJgrC3nX19domPw/thumb.jpg?1439208009', 
            key: 'DCB_021', type: 'node', value: 39, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429854/UtP5PLD97g1uxbsWjLtWrQ/thumb.jpg?1439208009', 
            key: 'DCB_022', type: 'node', value: 41, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429857/03qDhmPSUU1VMR2PSNmrAA/thumb.jpg?1439208009', 
            key: 'DCB_023', type: 'node', value: 42, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429856/W2mzwYZwI2IcUAnEfavj9w/thumb.jpg?1439208009', 
            key: 'DCB_024', type: 'node', value: 43, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429860/t39sYWQaInhd3gYf7D60_g/thumb.jpg?1439208009', 
            key: 'DCB_025', type: 'node', value: 45, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429855/JuHJH44JshVr0zDfnUsxnQ/thumb.jpg?1439208009', 
            key: 'DCB_026', type: 'node', value: 47, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429862/gxpuHUryqMIMSVzKyCcbRg/thumb.jpg?1439208009', 
            key: 'DCB_027', type: 'node', value: 51, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429861/t3jF33TnQrH-2hPx1Lp_Mw/thumb.jpg?1439208009', 
            key: 'DCB_028', type: 'node', value: 53, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429863/bmnruK9wJDAHKoqMYji-NQ/thumb.jpg?1439208009', 
            key: 'DCB_029', type: 'node', value: 54, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429859/9JXxbZn5kMCIuVvgoed7BQ/thumb.jpg?1439208009', 
            key: 'DCB_030', type: 'node', value: 55, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429870/Zf6zPVzbTY20mZkudnRvPA/thumb.jpg?1439208019', 
            key: 'DCB_031', type: 'node', value: 57, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429865/kCiFt4f8rV9_y9znA-nJAQ/thumb.jpg?1439208019', 
            key: 'DCB_032', type: 'node', value: 58, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429867/6Puglx5dg8A4W4R98f7HDg/thumb.jpg?1439208019', 
            key: 'DCB_033', type: 'node', value: 59, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429864/tpMotQ36qx-WfcmCpHre9g/thumb.jpg?1439208019', 
            key: 'DCB_034', type: 'node', value: 61, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429866/iQ3lM3APDfEYHgVn_-G9WQ/thumb.jpg?1439208019', 
            key: 'DCB_035', type: 'node', value: 62, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429873/2LEe3-IP0SwM4UtoQAecUw/thumb.jpg?1439208019', 
            key: 'DCB_036', type: 'node', value: 63, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429868/WbXFRJZpH8xRjOx3LdxnGg/thumb.jpg?1439208019', 
            key: 'DCB_037', type: 'node', value: 85, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429872/emP8girvIajhRTUaMZ6udA/thumb.jpg?1439208019', 
            key: 'DCB_038', type: 'node', value: 87, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429871/8UhFhcEReP4h9QZxDd6-OQ/thumb.jpg?1439208019', 
            key: 'DCB_039', type: 'node', value: 91, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429869/exKpoq-YTPRKjva4xrZ_fQ/thumb.jpg?1439208019', 
            key: 'DCB_040', type: 'node', value: 95, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429876/T_2Zfto93P-CAI5qB85YwA/thumb.jpg?1439208031', 
            key: 'DCB_041', type: 'node', value: 107, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429884/FfvJIkywpbJgU8DacHBVDw/thumb.jpg?1439208032', 
            key: 'DCB_042', type: 'node', value: 111, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429877/ov-XaGaE9FQoHLO9RSPVpw/thumb.jpg?1439208032', 
            key: 'DCB_043', type: 'node', value: 119, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429878/RHk0n-uVGeGuj6K7Af4hVA/thumb.jpg?1439208032', 
            key: 'DCB_044', type: 'node', value: 127, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429880/DdbGeOkI1-Ig_2bySliVlg/thumb.jpg?1439208032', 
            key: 'DCB_045', type: 'node', value: 170, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429883/xgv6WvAnemCR48CBkiL6Hg/thumb.jpg?1439208032', 
            key: 'DCB_046', type: 'node', value: 171, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429881/3Xi-1aGQrWMZfiVSxJYFwA/thumb.jpg?1439208032', 
            key: 'DCB_047', type: 'node', value: 175, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429879/7GmbxaZQj9FZhXGvMP3UgA/thumb.jpg?1439208032', 
            key: 'DCB_048', type: 'node', value: 187, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429882/AB2pVAxIhZZuLpnAfGbqXg/thumb.jpg?1439208032', 
            key: 'DCB_049', type: 'node', value: 191, degree: 0
        },
        {
            url: 'https://s3.amazonaws.com/files.d20.io/images/11429885/tlbzRSwWnJNZ_pfnah9ZDQ/thumb.jpg?1439208032', 
            key: 'DCB_050', type: 'node', value: 255, degree: 0
        },
    ];

    return {
       WallTextures: wallTextures
    };
}());
