#!/usr/bin/env python3
#
# Copyright (c) Bo Peng and the University of Texas MD Anderson Cancer Center
# Distributed under the terms of the 3-clause BSD License.

import time
import unittest

import pytest
from ipykernel.tests.utils import execute, wait_for_idle
from selenium.webdriver.common.keys import Keys
# from sos_notebook.test_utils import flush_channels, sos_kernel, NotebookTest
from test_utils import NotebookTest, flush_channels, sos_kernel


class TestFrontEnd(NotebookTest):

    @pytest.mark.skip(reason="upstream bug")
    def test_run_in_console(self, notebook):
        idx = notebook.call("print(1)", kernel="SoS")
        time.sleep(5)
        notebook.execute_cell(idx, in_console=True)
        # the latest history cell
        assert "1" == notebook.get_cell_output(-1, in_console=True)

        #if the cell is non-SoS, the console should also change kernel
        idx = notebook.call("cat(123)", kernel="R")
        notebook.execute_cell(idx, in_console=True)
        # the latest history cell
        assert "123" == notebook.get_cell_output(-1, in_console=True)

        idx = notebook.call("print(12345)", kernel="SoS")
        notebook.execute_cell(idx, in_console=True)
        # the latest history cell
        assert "12345" == notebook.get_cell_output(-1, in_console=True)

    def test_run_directly_in_console(self, notebook):
        notebook.open_console()
        notebook.edit_prompt_cell('print("haha")', kernel='SoS', execute=True)
        assert "haha" == notebook.get_cell_output(-1, in_console=True)

        notebook.edit_prompt_cell('cat("haha2")', kernel="R", execute=True)
        assert "haha2" == notebook.get_cell_output(-1, in_console=True)

    def test_history_in_console(self, notebook):
        notebook.open_console()
        notebook.edit_prompt_cell("a = 1", execute=True)
        assert "" == notebook.get_prompt_content()
        notebook.edit_prompt_cell("b <- 2", kernel="R", execute=True)
        assert "" == notebook.get_prompt_content()
        # notebook.prompt_cell.send_keys(Keys.UP)
        notebook.send_keys_on_prompt_cell(Keys.UP)
        time.sleep(5)
        assert "b <- 2" == notebook.get_prompt_content()
        notebook.send_keys_on_prompt_cell(Keys.UP)
        time.sleep(5)
        # notebook.prompt_cell.send_keys(Keys.UP)
        assert "a = 1" == notebook.get_prompt_content()
        # FIXME: down keys does not work, perhaps because the cell is not focused and
        # the first step would be jumping to the end of the line
        notebook.send_keys_on_prompt_cell(Keys.DOWN)
        notebook.send_keys_on_prompt_cell(Keys.DOWN)
        #  assert 'b <- 2' == notebook.get_prompt_content()

    def test_clear_history(self, notebook):
        notebook.open_console()
        notebook.edit_prompt_cell("a = 1", execute=True)
        notebook.edit_prompt_cell("b <- 2", kernel="R", execute=True)
        # use "clear" to clear all panel cells
        notebook.edit_prompt_cell("clear", kernel="SoS", execute=True)
        # we cannot wait for the completion of the cell because the cells
        # will be cleared
        # notebook.prompt_cell.send_keys(Keys.CONTROL, Keys.ENTER)
        assert not notebook.panel_cells

    def test_switch_kernel(self, notebook):
        kernels = notebook.get_kernel_list()
        assert "SoS" in kernels
        assert "R" in kernels
        backgroundColor = {
            "SoS": [0, 0, 0],
            "R": [220, 220, 218],
            "python3": [255, 217, 26],
        }

        # test change to R kernel by click
        notebook.select_kernel(index=0, kernel_name="R", by_click=True)
        # check background color for R kernel
        assert backgroundColor["R"], notebook.get_input_backgroundColor(0)

        # the cell keeps its color after evaluation
        notebook.edit_cell(
            index=0,
            content="""\
            %preview -n rn
            rn <- rnorm(5)
            """,
            render=True,
        )
        output = notebook.get_cell_output(0)
        assert "rn" in output and "num" in output
        assert backgroundColor["R"], notebook.get_output_backgroundColor(0)

        # test $get and shift to SoS kernel
        idx = notebook.call(
            """\
            %get rn --from R
            len(rn)
            """,
            kernel="SoS",
        )
        assert backgroundColor["SoS"], notebook.get_input_backgroundColor(idx)
        assert "5" in notebook.get_cell_output(idx)

        # switch to python3 kernel
        idx = notebook.call(
            """\
            %use Python3
            """,
            kernel="SoS",
        )
        assert backgroundColor["python3"] == notebook.get_input_backgroundColor(
            idx)

        notebook.append_cell("")
        assert backgroundColor["python3"] == notebook.get_input_backgroundColor(
            idx)



if __name__ == "__main__":
    unittest.main()
