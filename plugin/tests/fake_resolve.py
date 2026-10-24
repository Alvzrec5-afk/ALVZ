"""Un faux Resolve, juste assez pour tester le contrôleur sans DaVinci."""


class FakeGraph:
    def __init__(self, labels):
        self.labels = list(labels)
        self.luts = {}
        self.enabled = {}

    def GetNumNodes(self):
        return len(self.labels)

    def GetNodeLabel(self, i):
        return self.labels[i - 1]

    def SetLUT(self, i, path):
        if not 1 <= i <= len(self.labels):
            return False
        self.luts[i] = path
        return True

    def GetLUT(self, i):
        return self.luts.get(i, "")

    def ApplyGradeFromDRX(self, path, mode):
        self.labels = ["AZ_IN", "AZ_BAL", "AZ_TONE", "AZ_LOOK", "AZ_OUT"]
        self.luts = {}
        return True


class FakeItem:
    def __init__(self, uid, name, labels=("",)):
        self.uid, self.name = uid, name
        self.graph = FakeGraph(labels)
        self.cdl_calls = []

    def GetUniqueId(self):
        return self.uid

    def GetName(self):
        return self.name

    def GetNodeGraph(self):
        return self.graph

    def SetCDL(self, cdl):
        self.cdl_calls.append(cdl)
        return True


class FakeTimeline:
    def __init__(self):
        self.current = None

    def GetCurrentVideoItem(self):
        return self.current


class FakeProject:
    def __init__(self, name="Projet test"):
        self.name = name
        self.timeline = FakeTimeline()
        self.refreshes = 0

    def GetName(self):
        return self.name

    def GetCurrentTimeline(self):
        return self.timeline

    def RefreshLUTList(self):
        self.refreshes += 1
        return True


class FakeResolve:
    def __init__(self):
        self.project = FakeProject()

    def GetProjectManager(self):
        return self

    def GetCurrentProject(self):
        return self.project
